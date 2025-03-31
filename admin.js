// Initialize Supabase client
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
const supabase = supabase.createClient(supabaseUrl, supabaseKey)

// DOM Elements
const loadingElement = document.getElementById('loading')
const userNameElement = document.getElementById('user-name')
const logoutButton = document.getElementById('logout')
const tabButtons = document.querySelectorAll('.tab-button')
const requestsTab = document.getElementById('requests-tab')
const usersTab = document.getElementById('users-tab')
const searchRequests = document.getElementById('search-requests')
const filterStatus = document.getElementById('filter-status')
const refreshRequestsButton = document.getElementById('refresh-requests')
const requestsTable = document.getElementById('requests-table')
const addUserButton = document.getElementById('add-user')
const searchUsers = document.getElementById('search-users')
const filterRole = document.getElementById('filter-role')
const usersContainer = document.getElementById('users-container')
const userModal = document.getElementById('user-modal')
const userForm = document.getElementById('user-form')
const modalTitle = document.getElementById('modal-title')

// Statistics Elements
const totalRequestsElement = document.getElementById('total-requests')
const openRequestsElement = document.getElementById('open-requests')
const completedRequestsElement = document.getElementById('completed-requests')
const activeUsersElement = document.getElementById('active-users')

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkSession()
        await loadStatistics()
        await loadRequests()
        await loadUsers()
    } catch (error) {
        console.error('Error initializing dashboard:', error)
        showError('Failed to initialize dashboard')
    }
})

logoutButton.addEventListener('click', handleLogout)
tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab))
})
searchRequests.addEventListener('input', debounce(loadRequests, 300))
filterStatus.addEventListener('change', loadRequests)
refreshRequestsButton.addEventListener('click', loadRequests)
addUserButton.addEventListener('click', () => openUserModal())
searchUsers.addEventListener('input', debounce(loadUsers, 300))
filterRole.addEventListener('change', loadUsers)
userForm.addEventListener('submit', handleUserSubmit)

// Session Management
async function checkSession() {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
        window.location.href = '/login.html'
        return
    }

    const { data: userData, error: userError } = await supabase
        .from('requests_users')
        .select('*')
        .eq('email', user.email)
        .single()

    if (userError || !userData || userData.role !== 'admin') {
        await handleLogout()
        return
    }

    userNameElement.textContent = userData.assignee
}

async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login.html'
}

// Statistics
async function loadStatistics() {
    showLoading()
    try {
        const [
            { count: totalRequests },
            { count: openRequests },
            { count: completedRequests },
            { count: activeUsers }
        ] = await Promise.all([
            supabase.from('requests').select('*', { count: 'exact' }),
            supabase.from('requests').select('*', { count: 'exact' }).eq('status', 'open'),
            supabase.from('requests').select('*', { count: 'exact' }).eq('status', 'completed'),
            supabase.from('requests_users').select('*', { count: 'exact' }).eq('status', 'active')
        ])

        totalRequestsElement.textContent = totalRequests || 0
        openRequestsElement.textContent = openRequests || 0
        completedRequestsElement.textContent = completedRequests || 0
        activeUsersElement.textContent = activeUsers || 0
    } catch (error) {
        console.error('Error loading statistics:', error)
        showError('Failed to load statistics')
    } finally {
        hideLoading()
    }
}

// Requests Management
async function loadRequests() {
    showLoading()
    try {
        let query = supabase
            .from('requests')
            .select('*')
            .order('created_at', { ascending: false })

        const searchTerm = searchRequests.value.trim()
        const statusFilter = filterStatus.value

        if (searchTerm) {
            query = query.or(`customer_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
        }

        if (statusFilter) {
            query = query.eq('status', statusFilter)
        }

        const { data: requests, error } = await query

        if (error) throw error

        requestsTable.innerHTML = requests.map(request => `
            <tr class="clickable-row" onclick="toggleRequestDetails(this, ${JSON.stringify(request)})">
                <td>${request.customer_name}</td>
                <td>${request.phone_number}</td>
                <td>
                    <span class="status-badge ${request.status}">
                        ${request.status}
                    </span>
                </td>
                <td>${request.sales_assignee || 'N/A'}</td>
                <td>${request.non_voice_assignee || 'N/A'}</td>
                <td>${new Date(request.created_at).toLocaleString()}</td>
                <td>
                    <button onclick="event.stopPropagation(); deleteRequest(${request.id})" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('')
    } catch (error) {
        console.error('Error loading requests:', error)
        showError('Failed to load requests')
    } finally {
        hideLoading()
    }
}

function toggleRequestDetails(row, request) {
    const expandedRow = document.querySelector('.expanded-row')
    if (expandedRow && expandedRow !== row) {
        expandedRow.classList.remove('expanded-row')
        expandedRow.nextElementSibling?.remove()
    }

    row.classList.toggle('expanded-row')
    const isExpanded = row.classList.contains('expanded-row')

    if (isExpanded) {
        const detailsRow = document.createElement('tr')
        detailsRow.innerHTML = `
            <td colspan="7">
                <div class="expanded-content">
                    <div class="notes-section">
                        <div class="notes-card">
                            <div class="notes-title">
                                <i class="fas fa-comment-alt text-blue-500"></i>
                                Sales Notes
                            </div>
                            <p>${request.notes || 'No sales notes'}</p>
                        </div>
                        <div class="notes-card">
                            <div class="notes-title">
                                <i class="fas fa-headset text-green-500"></i>
                                Non-Voice Notes
                            </div>
                            <p>${request.non_voice_notes || 'No non-voice notes'}</p>
                        </div>
                    </div>
                </div>
            </td>
        `
        row.parentNode.insertBefore(detailsRow, row.nextSibling)
    } else {
        row.nextElementSibling?.remove()
    }
}

async function deleteRequest(requestId) {
    if (!confirm('Are you sure you want to delete this request?')) return

    showLoading()
    try {
        const { error } = await supabase
            .from('requests')
            .delete()
            .eq('id', requestId)

        if (error) throw error

        await loadRequests()
        await loadStatistics()
        showSuccess('Request deleted successfully')
    } catch (error) {
        console.error('Error deleting request:', error)
        showError('Failed to delete request')
    } finally {
        hideLoading()
    }
}

// User Management
async function loadUsers() {
    showLoading()
    try {
        let query = supabase
            .from('requests_users')
            .select('*')
            .order('role', { ascending: true })

        const searchTerm = searchUsers.value.trim()
        const roleFilter = filterRole.value

        if (searchTerm) {
            query = query.or(`email.ilike.%${searchTerm}%,assignee.ilike.%${searchTerm}%`)
        }

        if (roleFilter) {
            query = query.eq('role', roleFilter)
        }

        const { data: users, error } = await query

        if (error) throw error

        usersContainer.innerHTML = users.map(user => `
            <div class="user-card">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-semibold text-gray-900">${user.assignee}</h3>
                        <p class="text-gray-500 text-sm">${user.email}</p>
                        <div class="flex items-center mt-2">
                            <span class="badge ${user.role}">${user.role}</span>
                            <span class="badge ${user.status} ml-2">${user.status}</span>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="openUserModal(${JSON.stringify(user)})" class="btn btn-secondary btn-sm">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteUser('${user.email}')" class="btn btn-danger btn-sm">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('')
    } catch (error) {
        console.error('Error loading users:', error)
        showError('Failed to load users')
    } finally {
        hideLoading()
    }
}

function openUserModal(user = null) {
    const userIdInput = document.getElementById('user-id')
    const userEmailInput = document.getElementById('user-email')
    const userRoleInput = document.getElementById('user-role')
    const userAssigneeInput = document.getElementById('user-assignee')

    if (user) {
        modalTitle.textContent = 'Edit User'
        userIdInput.value = user.id || ''
        userEmailInput.value = user.email || ''
        userRoleInput.value = user.role || 'sales'
        userAssigneeInput.value = user.assignee || ''
        userEmailInput.disabled = true
    } else {
        modalTitle.textContent = 'Add New User'
        userForm.reset()
        userEmailInput.disabled = false
    }

    userModal.classList.remove('hidden')
}

function closeUserModal() {
    userModal.classList.add('hidden')
    userForm.reset()
}

async function handleUserSubmit(event) {
    event.preventDefault()
    showLoading()

    const userId = document.getElementById('user-id').value
    const email = document.getElementById('user-email').value
    const role = document.getElementById('user-role').value
    const assignee = document.getElementById('user-assignee').value

    try {
        let error
        if (userId) {
            // Update existing user
            ({ error } = await supabase
                .from('requests_users')
                .update({
                    role,
                    assignee,
                    updated_at: new Date().toISOString()
                })
                .eq('email', email))
        } else {
            // Create new user
            ({ error } = await supabase
                .from('requests_users')
                .insert({
                    email,
                    role,
                    assignee,
                    status: 'active'
                }))
        }

        if (error) throw error

        closeUserModal()
        await loadUsers()
        await loadStatistics()
        showSuccess(`User ${userId ? 'updated' : 'created'} successfully`)
    } catch (error) {
        console.error('Error saving user:', error)
        showError('Failed to save user')
    } finally {
        hideLoading()
    }
}

async function deleteUser(email) {
    if (!confirm('Are you sure you want to delete this user?')) return

    showLoading()
    try {
        const { error } = await supabase
            .from('requests_users')
            .delete()
            .eq('email', email)

        if (error) throw error

        await loadUsers()
        await loadStatistics()
        showSuccess('User deleted successfully')
    } catch (error) {
        console.error('Error deleting user:', error)
        showError('Failed to delete user')
    } finally {
        hideLoading()
    }
}

// UI Helpers
function switchTab(tabName) {
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName)
    })

    requestsTab.classList.toggle('hidden', tabName !== 'requests')
    usersTab.classList.toggle('hidden', tabName !== 'users')

    if (tabName === 'requests') {
        loadRequests()
    } else {
        loadUsers()
    }
}

function showLoading() {
    loadingElement.classList.remove('hidden')
}

function hideLoading() {
    loadingElement.classList.add('hidden')
}

function showSuccess(message) {
    // Implement your success notification
    alert(message)
}

function showError(message) {
    // Implement your error notification
    alert(message)
}

function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
} 
