// Initialize Supabase client
const supabaseUrl = 'https://pdcssepqmgzpkayzfqta.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkY3NzZXBxbWd6cGtheXpmcXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MzczMjksImV4cCI6MjA1NjQxMzMyOX0.NqN7b7itdA8Tz0sG4fzSI4Y19P5syYFWnmKwANbH1IY'
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

let currentUser = null

document.addEventListener('DOMContentLoaded', async () => {
    // Check session
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
        window.location.href = 'login.html'
        return
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
        .from('requests_users')
        .select('*')
        .eq('email', session.user.email)
        .single()

    if (userError || (userData.role !== 'sales' && userData.role !== 'admin')) {
        window.location.href = 'login.html'
        return
    }

    currentUser = { ...session.user, ...userData }
    document.getElementById('user-name').textContent = currentUser.assignee
    
    // Hide loading spinner
    document.getElementById('loading').classList.add('hidden')

    // Load requests
    loadMyRequests()

    // Add event listeners
    document.getElementById('sales-form').addEventListener('submit', handleRequestSubmit)
    document.getElementById('logout-link').addEventListener('click', handleLogout)
    document.getElementById('refresh-btn').addEventListener('click', loadMyRequests)
})

async function handleRequestSubmit(event) {
    event.preventDefault()
    
    const customerName = document.getElementById('customer-name').value
    const customerPhone = document.getElementById('customer-phone').value
    const notes = document.getElementById('notes').value

    try {
        // Show loading indicator
        const submitButton = event.target.querySelector('button[type="submit"]')
        const originalButtonText = submitButton.innerHTML
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...'
        submitButton.disabled = true
        
        // Get available non-voice employee
        const { data: availableEmployee, error: employeeError } = await supabase
            .from('requests_users')
            .select('assignee')
            .eq('role', 'non-voice')
            .eq('status', 'ready')
            .limit(1)
            .single()

        // Set appropriate status based on assignment
        // If an employee is assigned, set status to in-progress so it shows in their dashboard
        // If no employee is assigned, set status to open
        const status = availableEmployee?.assignee ? 'in-progress' : 'open'
        const assigned_to = availableEmployee?.assignee || null

        // Create new request
        const { data: newRequest, error } = await supabase
            .from('requests')
            .insert([{
                customer_name: customerName,
                phone_number: customerPhone,
                notes: notes,
                status: status,
                assigned_to: assigned_to,
                sales_assignee: currentUser.assignee,
                created_at: new Date().toISOString()
            }])
            .select()

        if (error) throw error

        // Notify user of success
        submitButton.innerHTML = '<i class="fas fa-check mr-2"></i> Submitted!'
        submitButton.classList.add('btn-success')
        
        // Reset form and reload requests
        setTimeout(() => {
            event.target.reset()
            submitButton.innerHTML = originalButtonText
            submitButton.classList.remove('btn-success')
            submitButton.disabled = false
            loadMyRequests()
        }, 1500)
        
        // Show success message
        alert('Request submitted successfully!' + 
              (assigned_to ? ` Assigned to ${assigned_to}.` : ' No agents available at the moment.'))
    } catch (error) {
        console.error('Error submitting request:', error)
        alert('Error submitting request: ' + error.message)
        
        // Reset button
        const submitButton = event.target.querySelector('button[type="submit"]')
        submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Submit Request'
        submitButton.disabled = false
    }
}

async function loadMyRequests() {
    try {
        const { data: requests, error } = await supabase
            .from('requests')
            .select('*')
            .eq('sales_assignee', currentUser.assignee)
            .order('created_at', { ascending: false })

        if (error) throw error

        const requestsTable = document.getElementById('my-requests')
        
        if (!requests || requests.length === 0) {
            requestsTable.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-3"></i>
                        <p>No requests submitted yet</p>
                    </td>
                </tr>
            `
            return
        }

        requestsTable.innerHTML = requests.map(request => `
            <tr class="clickable-row animate-fade-in" onclick="toggleExpandedRow(this, '${request.id}')">
                <td class="font-medium text-gray-900">${request.customer_name || ''}</td>
                <td>${request.phone_number || ''}</td>
                <td>
                    <span class="status-pill status-${request.status}">
                        <i class="fas fa-${getStatusIcon(request.status)}"></i>
                        ${formatRequestStatus(request.status)}
                    </span>
                </td>
                <td>${request.assigned_to || 'Unassigned'}</td>
                <td>${formatDate(request.created_at)}</td>
            </tr>
            <tr class="expanded-content hidden" id="expanded-${request.id}">
                <td colspan="5">
                    <div class="notes-section">
                        <div class="notes-card">
                            <div class="notes-title">
                                <i class="fas fa-comment text-blue-500"></i>
                                Sales Notes
                            </div>
                            <p class="text-gray-600">${request.notes || 'No sales notes available'}</p>
                        </div>
                        <div class="notes-card">
                            <div class="notes-title">
                                <i class="fas fa-note-sticky text-green-500"></i>
                                Non-Voice Notes
                            </div>
                            <p class="text-gray-600">${request.non_voice_notes || 'No non-voice notes added yet'}</p>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('')
    } catch (error) {
        console.error('Error loading requests:', error)
        alert('Failed to load requests')
    }
}

// Helper function to get status icon
function getStatusIcon(status) {
    switch (status) {
        case 'open': return 'door-open'
        case 'in-progress': return 'spinner'
        case 'completed': return 'check-circle'
        case 'request-issue': return 'exclamation-triangle'
        case 'waiting-request': return 'clock'
        default: return 'circle'
    }
}

// Format request status name for better display
function formatRequestStatus(status) {
    switch (status) {
        case 'open': return 'Open'
        case 'in-progress': return 'In Progress'
        case 'completed': return 'Done'
        case 'request-issue': return 'Request Issue'
        case 'waiting-request': return 'Waiting Request'
        default: return status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
}

// Format date helper
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    }
    return new Date(dateString).toLocaleDateString('en-US', options)
}

// Toggle expanded row
function toggleExpandedRow(row, requestId) {
    const expandedRow = document.getElementById(`expanded-${requestId}`)
    const allExpandedRows = document.querySelectorAll('.expanded-content')
    
    // Close all other expanded rows
    allExpandedRows.forEach(r => {
        if (r.id !== `expanded-${requestId}`) {
            r.classList.add('hidden')
        }
    })

    // Toggle clicked row
    expandedRow.classList.toggle('hidden')
    row.classList.toggle('expanded-row')
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        window.location.href = 'login.html'
    } catch (error) {
        console.error('Error signing out:', error)
        alert('Failed to sign out')
    }
}
