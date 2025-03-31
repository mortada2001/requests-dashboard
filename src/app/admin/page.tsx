'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type SalesRequest = Database['public']['Tables']['sales_requests']['Row']

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([])
  const [requests, setRequests] = useState<SalesRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee')

  useEffect(() => {
    fetchData()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('admin_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUsers((prev) => [...prev, payload.new as User])
          } else if (payload.eventType === 'UPDATE') {
            setUsers((prev) =>
              prev.map((user) =>
                user.id === payload.new.id ? (payload.new as User) : user
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchData = async () => {
    try {
      const [usersResponse, requestsResponse] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('sales_requests').select('*'),
      ])

      if (usersResponse.error) throw usersResponse.error
      if (requestsResponse.error) throw requestsResponse.error

      setUsers(usersResponse.data || [])
      setRequests(requestsResponse.data || [])
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('users').insert([
        {
          email: newUserEmail,
          role: newUserRole,
        },
      ])

      if (error) throw error
      setNewUserEmail('')
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'employee') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
    } catch (error: any) {
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const stats = {
    totalRequests: requests.length,
    pendingRequests: requests.filter((r) => r.status === 'pending').length,
    approvedRequests: requests.filter((r) => r.status === 'approved').length,
    rejectedRequests: requests.filter((r) => r.status === 'rejected').length,
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card"
          >
            <h3 className="text-sm font-medium text-gray-400">Total Requests</h3>
            <p className="text-2xl font-bold">{stats.totalRequests}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <h3 className="text-sm font-medium text-gray-400">Pending</h3>
            <p className="text-2xl font-bold text-yellow-500">{stats.pendingRequests}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h3 className="text-sm font-medium text-gray-400">Approved</h3>
            <p className="text-2xl font-bold text-green-500">{stats.approvedRequests}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h3 className="text-sm font-medium text-gray-400">Rejected</h3>
            <p className="text-2xl font-bold text-red-500">{stats.rejectedRequests}</p>
          </motion.div>
        </div>

        {/* User Management */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <form onSubmit={handleAddUser} className="flex gap-4 mb-6">
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="Enter user email"
              className="input-field flex-1"
              required
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'employee')}
              className="input-field w-40"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-primary">
              Add User
            </button>
          </form>

          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 bg-dark-800 rounded-lg"
              >
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-gray-400">Role: {user.role}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateUserRole(user.id, 'admin')}
                    className={`btn-primary ${
                      user.role === 'admin'
                        ? 'bg-primary-600'
                        : 'bg-dark-700 hover:bg-dark-600'
                    }`}
                  >
                    Make Admin
                  </button>
                  <button
                    onClick={() => handleUpdateUserRole(user.id, 'employee')}
                    className={`btn-primary ${
                      user.role === 'employee'
                        ? 'bg-primary-600'
                        : 'bg-dark-700 hover:bg-dark-600'
                    }`}
                  >
                    Make Employee
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
} 