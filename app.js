// Initialize Supabase client
const supabaseUrl = 'https://pdcssepqmgzpkayzfqta.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkY3NzZXBxbWd6cGtheXpmcXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MzczMjksImV4cCI6MjA1NjQxMzMyOX0.NqN7b7itdA8Tz0sG4fzSI4Y19P5syYFWnmKwANbH1IY'
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

let currentUser = null

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const loginForm = document.getElementById('login-form')
    const salesForm = document.getElementById('sales-form')
    const nonVoiceDashboard = document.getElementById('non-voice-dashboard')
    const adminDashboard = document.getElementById('admin-dashboard')
    const nonVoiceLink = document.getElementById('non-voice-link')
    const logoutLink = document.getElementById('logout-link')

    // Initialize view
    hideAllViews()
    if (loginForm) {
        loginForm.style.display = 'block'
    }

    // Add event listeners
    if (nonVoiceLink) {
        nonVoiceLink.addEventListener('click', () => showNonVoiceDashboard())
    }
    if (logoutLink) {
        logoutLink.addEventListener('click', handleLogout)
    }

    // Check for existing session
    checkSession()
})

function hideAllViews() {
    const views = ['login-form', 'sales-form', 'non-voice-dashboard', 'admin-dashboard']
    views.forEach(view => {
        const element = document.getElementById(view)
        if (element) {
            element.style.display = 'none'
        }
    })
}

async function handleLogin() {
    const emailInput = document.getElementById('email')
    const passwordInput = document.getElementById('password')

    if (!emailInput || !passwordInput) {
        console.error('Login form elements not found')
        return
    }

    const email = emailInput.value
    const password = passwordInput.value

    if (!email || !password) {
        alert('Please enter both email and password')
        return
    }

    try {
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error

        currentUser = user
        await loadUserRole()
        hideAllViews()
        showDashboard()
    } catch (error) {
        alert('Error logging in: ' + error.message)
    }
}

async function loadUserRole() {
    if (!currentUser) return

    try {
        const { data, error } = await supabase
            .from('requests_users')
            .select('role, assignee')
            .eq('email', currentUser.email)
            .single()

        if (error) throw error

        currentUser = { ...currentUser, ...data }
    } catch (error) {
        console.error('Error loading user role:', error)
    }
}

function showDashboard() {
    if (!currentUser) return

    switch (currentUser.role) {
        case 'sales':
            const salesForm = document.getElementById('sales-form')
            if (salesForm) salesForm.style.display = 'block'
            break
        case 'non-voice':
            showNonVoiceDashboard()
            break
        case 'admin':
            const adminDashboard = document.getElementById('admin-dashboard')
            if (adminDashboard) {
                adminDashboard.style.display = 'block'
                loadAdminData()
            }
            break
        case 'back-office':
            window.location.href = 'tickets.html'
            break
        case 'admin-back-office':
            window.location.href = 'backofficeadmin.html'
            break
    }
}

async function handleRequestSubmit(event) {
    event.preventDefault()
    
    const customerNameInput = document.getElementById('customer-name')
    const customerPhoneInput = document.getElementById('customer-phone')
    const notesInput = document.getElementById('notes')

    if (!customerNameInput || !customerPhoneInput || !notesInput) {
        console.error('Form elements not found')
        return
    }

    const customerName = customerNameInput.value
    const customerPhone = customerPhoneInput.value
    const notes = notesInput.value

    if (!customerName || !customerPhone || !notes) {
        alert('Please fill in all fields')
        return
    }

    try {
        // Get available non-voice employees
        const { data: availableEmployees, error: employeeError } = await supabase
            .from('requests_users')
            .select('email, assignee')
            .eq('role', 'non-voice')
            .eq('status', 'ready')

        if (employeeError) throw employeeError

        // Get the first available employee or null if none are available
        const availableEmployee = availableEmployees && availableEmployees.length > 0 ? availableEmployees[0] : null

        const { error } = await supabase
            .from('requests')
            .insert([{
                customer_name: customerName,
                phone_number: customerPhone,
                notes: notes,
                status: 'open',
                assigned_to: availableEmployee ? availableEmployee.assignee : null,
                sales_assignee: currentUser.assignee,
                created_at: new Date().toISOString()
            }])

        if (error) throw error

        // Reset form
        const form = document.getElementById('sales-form')
        if (form && form instanceof HTMLFormElement) {
            form.reset()
        }
        
        alert('Request submitted successfully!')
    } catch (error) {
        alert('Error submitting request: ' + error.message)
    }
}

async function showNonVoiceDashboard() {
    hideAllViews()
    const dashboard = document.getElementById('non-voice-dashboard')
    if (dashboard) {
        dashboard.style.display = 'block'
        await loadAssignedRequests()
    }
}

async function loadAssignedRequests() {
    if (!currentUser?.assignee) return

    try {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .eq('assigned_to', currentUser.assignee)
            .order('created_at', { ascending: false })

        if (error) throw error

        const assignedRequests = document.getElementById('assigned-requests')
        if (!assignedRequests) {
            console.error('Assigned requests element not found')
            return
        }

        if (!data || data.length === 0) {
            assignedRequests.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">No requests assigned</td>
                </tr>
            `
            return
        }

        assignedRequests.innerHTML = data.map(request => `
            <tr>
                <td>${request.customer_name || ''}</td>
                <td>${request.phone_number || ''}</td>
                <td>${request.notes || ''}</td>
                <td><span class="status-badge status-${request.status || 'open'}">${request.status || 'open'}</span></td>
                <td>
                    ${request.status === 'open' ? 
                        `<button class="btn btn-primary" onclick="handleRequest('${request.id}')">Handle</button>` :
                        `<span>Closed</span>`
                    }
                </td>
            </tr>
        `).join('')
    } catch (error) {
        console.error('Error loading assigned requests:', error)
    }
}

async function handleRequest(requestId) {
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Handle Request</h3>
            <form id="handle-request-form">
                <div class="form-group">
                    <label class="form-label">Response Notes</label>
                    <textarea class="form-input" id="response-notes" required></textarea>
                </div>
                <div class="form-group">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Close Request</button>
                </div>
            </form>
        </div>
    `

    document.body.appendChild(modal)

    const form = modal.querySelector('form')
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault()
            const notesInput = document.getElementById('response-notes')
            if (!notesInput) return

            try {
                const { error } = await supabase
                    .from('requests')
                    .update({
                        status: 'closed',
                        non_voice_notes: notesInput.value
                    })
                    .eq('id', requestId)

                if (error) throw error

                modal.remove()
                await loadAssignedRequests()
            } catch (error) {
                alert('Error closing request: ' + error.message)
            }
        })
    }
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error

        currentUser = null
        hideAllViews()
        const loginForm = document.getElementById('login-form')
        if (loginForm) {
            loginForm.style.display = 'block'
        }
    } catch (error) {
        alert('Error signing out: ' + error.message)
    }
}

async function checkSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (session) {
            currentUser = session.user
            await loadUserRole()
            showDashboard()
        }
    } catch (error) {
        console.error('Error checking session:', error)
    }
}

async function updateEmployeeStatus(status) {
    if (!currentUser?.assignee) return

    try {
        const { error } = await supabase
            .from('requests_users')
            .update({ status })
            .eq('assignee', currentUser.assignee)

        if (error) throw error

        if (status === 'break') {
            await reassignRequests(currentUser.assignee)
        }

        // Update UI to reflect status change
        const readyBtn = document.querySelector('button[onclick="updateEmployeeStatus(\'ready\')"]')
        const breakBtn = document.querySelector('button[onclick="updateEmployeeStatus(\'break\')"]')
        
        if (readyBtn && breakBtn) {
            if (status === 'ready') {
                readyBtn.classList.add('btn-primary')
                breakBtn.classList.remove('btn-primary')
            } else {
                breakBtn.classList.add('btn-primary')
                readyBtn.classList.remove('btn-primary')
            }
        }
    } catch (error) {
        alert('Error updating status: ' + error.message)
    }
}

async function reassignRequests(currentAssignee) {
    try {
        // Get available non-voice employee
        const { data: availableEmployees, error: employeeError } = await supabase
            .from('requests_users')
            .select('assignee')
            .eq('role', 'non-voice')
            .eq('status', 'ready')
            .neq('assignee', currentAssignee)

        if (employeeError) throw employeeError

        // If no available employees, leave requests as is
        if (!availableEmployees || availableEmployees.length === 0) {
            console.log('No available employees to reassign requests to')
            return
        }

        // Get the first available employee
        const newAssignee = availableEmployees[0].assignee

        // Reassign open requests to available employee
        const { error: updateError } = await supabase
            .from('requests')
            .update({ assigned_to: newAssignee })
            .eq('assigned_to', currentAssignee)
            .eq('status', 'open')

        if (updateError) throw updateError

        console.log(`Successfully reassigned requests to ${newAssignee}`)

    } catch (error) {
        console.error('Error reassigning requests:', error)
        alert('Error reassigning requests: ' + error.message)
    }
}

async function loadAdminData() {
    try {
        // Load statistics
        const { data: stats } = await supabase
            .from('requests')
            .select('status')

        if (stats) {
            const total = stats.length
            const open = stats.filter(r => r.status === 'open').length
            const closed = stats.filter(r => r.status === 'closed').length

            const totalElement = document.getElementById('total-requests')
            const openElement = document.getElementById('open-requests')
            const closedElement = document.getElementById('closed-requests')

            if (totalElement) totalElement.textContent = total
            if (openElement) openElement.textContent = open
            if (closedElement) closedElement.textContent = closed
        }

        // Load employee performance
        const { data: employees } = await supabase
            .from('requests_users')
            .select('*')
            .eq('role', 'non-voice')

        const employeePerformance = document.getElementById('employee-performance')
        if (employeePerformance && employees) {
            employeePerformance.innerHTML = employees.map(employee => `
                <tr>
                    <td>${employee.assignee}</td>
                    <td><span class="status-badge status-${employee.status}">${employee.status}</span></td>
                    <td>${employee.requests_handled || 0}</td>
                    <td>${employee.avg_response_time || 'N/A'}</td>
                </tr>
            `).join('')
        }

        // Load all requests
        const { data: requests } = await supabase
            .from('requests')
            .select('*')
            .order('created_at', { ascending: false })

        const allRequests = document.getElementById('all-requests')
        if (allRequests && requests) {
            allRequests.innerHTML = requests.map(request => `
                <tr>
                    <td>${request.customer_name || ''}</td>
                    <td>${request.phone_number || ''}</td>
                    <td>${request.notes || ''}</td>
                    <td><span class="status-badge status-${request.status}">${request.status}</span></td>
                    <td>${request.assigned_to || 'Unassigned'}</td>
                    <td>${request.sales_assignee || ''}</td>
                    <td>${request.non_voice_notes || ''}</td>
                    <td>${new Date(request.created_at).toLocaleString()}</td>
                </tr>
            `).join('')
        }
    } catch (error) {
        console.error('Error loading admin data:', error)
    }
}
