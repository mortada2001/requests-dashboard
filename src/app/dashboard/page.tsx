'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type SalesRequest = Database['public']['Tables']['sales_requests']['Row']

export default function DashboardPage() {
  const [requests, setRequests] = useState<SalesRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('sales_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales_requests',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests((prev) => [...prev, payload.new as SalesRequest])
          } else if (payload.eventType === 'UPDATE') {
            setRequests((prev) =>
              prev.map((req) =>
                req.id === payload.new.id ? (payload.new as SalesRequest) : req
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

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(data || [])
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('sales_requests')
        .update({ status })
        .eq('id', id)

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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-2xl font-bold mb-8">Sales Requests Dashboard</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requests.map((request) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold">{request.customer_name}</h2>
                <span
                  className={`px-2 py-1 rounded-full text-sm ${
                    request.status === 'approved'
                      ? 'bg-green-500/10 text-green-500'
                      : request.status === 'rejected'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}
                >
                  {request.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Email:</span> {request.email}
                </p>
                <p>
                  <span className="font-medium">Phone:</span> {request.phone}
                </p>
                <p>
                  <span className="font-medium">Product:</span> {request.product}
                </p>
                <p>
                  <span className="font-medium">Quantity:</span> {request.quantity}
                </p>
                {request.notes && (
                  <p>
                    <span className="font-medium">Notes:</span> {request.notes}
                  </p>
                )}
              </div>

              {request.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => updateRequestStatus(request.id, 'approved')}
                    className="btn-primary bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateRequestStatus(request.id, 'rejected')}
                    className="btn-primary bg-red-600 hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
} 