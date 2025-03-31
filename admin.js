// Just use the pre-initialized Supabase client from the HTML file
// No need to reinitialize it here

// DOM Elements
const loadingElement = document.getElementById('loading')
const userNameElement = document.getElementById('user-name')
const logoutButton = document.getElementById('logout')
const tabButtons = document.querySelectorAll('.tab-button')
const requestsTab = document.getElementById('requests-tab')
const employeesTab = document.getElementById('employees-tab')
const searchRequests = document.getElementById('search-requests')
const filterStatus = document.getElementById('filter-status')
const refreshRequestsButton = document.getElementById('refresh-requests')
const requestsTable = document.getElementById('requests-table')
const searchEmployees = document.getElementById('search-employees')
const filterEmployeeStatus = document.getElementById('filter-employee-status')
const employeesContainer = document.getElementById('employees-container')

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
        await loadEmployees()
    } catch (error) {
        console.error('Error initializing dashboard:', error)
        showError('Failed to initialize dashboard')
    }
})

logoutButton.addEventListener('click', handleLogout)
tabButtons.forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab))
})

// Enhanced search with visual feedback
searchRequests.addEventListener('input', () => {
    const searchTerm = searchRequests.value.trim();
    
    // Visual feedback that search is happening
    if (searchTerm.length > 0) {
        searchRequests.classList.add('searching');
        refreshRequestsButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Searching...';
    } else {
        searchRequests.classList.remove('searching');
        refreshRequestsButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh';
    }
    
    // Debounce the actual search
    debounce(loadRequests, 300)();
});

filterStatus.addEventListener('change', loadRequests)
refreshRequestsButton.addEventListener('click', loadRequests)
searchEmployees.addEventListener('input', debounce(loadEmployees, 300))
filterEmployeeStatus.addEventListener('change', loadEmployees)

// Session Management
async function checkSession() {
    const { data: { user }, error } = await window.supabase.auth.getUser()
    
    if (error || !user) {
        window.location.href = '/login.html'
        return
    }

    const { data: userData, error: userError } = await window.supabase
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
    await window.supabase.auth.signOut()
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
            window.supabase.from('requests').select('*', { count: 'exact' }),
            window.supabase.from('requests').select('*', { count: 'exact' }).eq('status', 'open'),
            window.supabase.from('requests').select('*', { count: 'exact' }).eq('status', 'completed'),
            window.supabase.from('requests_users').select('*', { count: 'exact' }).eq('status', 'active')
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
    // Show a loading overlay on the table instead of refreshing the whole page
    const tableContainer = requestsTable.closest('.table-container');
    
    // Create or find existing overlay
    let loadingOverlay = tableContainer.querySelector('.table-loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'table-loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner-container"><div class="loading-spinner"></div></div>';
        tableContainer.style.position = 'relative';
        tableContainer.appendChild(loadingOverlay);
    }
    
    // Show the overlay
    loadingOverlay.style.display = 'flex';
    
    try {
        let query = window.supabase
            .from('requests')
            .select('*')
            .order('created_at', { ascending: false })

        const searchTerm = searchRequests.value.trim()
        const statusFilter = filterStatus.value

        if (searchTerm) {
            if (!isNaN(searchTerm)) {
                query = query.or(`customer_name.ilike.%${searchTerm}%,phone_number.eq.${searchTerm}`)
            } else {
                query = query.ilike('customer_name', `%${searchTerm}%`)
            }
        }

        if (statusFilter) {
            query = query.eq('status', statusFilter)
        }

        const { data: requests, error } = await query

        if (error) throw error

        // Update table content directly
        requestsTable.innerHTML = requests.map(request => `
            <tr class="clickable-row" data-id="${request.id}" onclick="toggleRequestDetails(this, ${JSON.stringify(request)})">
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
                    <button onclick="event.stopPropagation(); deleteRequest('${request.id}')" class="btn btn-danger btn-sm">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('')
        
        // Reset search UI if search is complete
        if (searchRequests.classList.contains('searching')) {
            refreshRequestsButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh';
        }
    } catch (error) {
        console.error('Error loading requests:', error)
        showError('Failed to load requests')
    } finally {
        // Hide loading overlay when done
        loadingOverlay.style.display = 'none';
        hideLoading();
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

    // Find the row and its expanded content (if any)
    const rowToDelete = document.querySelector(`tr[data-id="${requestId}"]`);
    if (!rowToDelete) return;
    
    const expandedContent = rowToDelete.nextElementSibling && 
        rowToDelete.nextElementSibling.querySelector('.expanded-content') ? 
        rowToDelete.nextElementSibling : null;
    
    // Show a loading spinner on the row instead of the global loading
    rowToDelete.style.opacity = '0.5';
    
    try {
        // Convert requestId to number if it's a string numeric value
        const id = !isNaN(requestId) ? Number(requestId) : requestId;
        
        const { error } = await window.supabase
            .from('requests')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Success - animate and remove the row
        rowToDelete.style.transition = 'opacity 0.3s ease, height 0.3s ease, padding 0.3s ease';
        rowToDelete.style.opacity = '0';
        
        setTimeout(() => {
            if (expandedContent) {
                expandedContent.style.transition = 'opacity 0.3s ease, height 0.3s ease';
                expandedContent.style.opacity = '0';
                expandedContent.style.height = '0';
                
                setTimeout(() => expandedContent.remove(), 300);
            }
            
            rowToDelete.style.height = '0';
            rowToDelete.style.padding = '0';
            
            setTimeout(() => {
                rowToDelete.remove();
                
                // Just update the statistics without reloading all requests
                loadStatistics();
                
                showSuccess('Request deleted successfully');
            }, 300);
        }, 300);
    } catch (error) {
        // Error - restore the row appearance
        rowToDelete.style.opacity = '1';
        
        console.error('Error deleting request:', error);
        showError('Failed to delete request');
    }
}

// Employee Management
async function loadEmployees() {
    // Show a loading overlay on the employees container
    const container = employeesContainer.closest('.grid');
    
    // Create or find existing overlay
    let loadingOverlay = container.querySelector('.employees-loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'table-loading-overlay employees-loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner-container"><div class="loading-spinner"></div></div>';
        container.style.position = 'relative';
        container.appendChild(loadingOverlay);
    }
    
    // Show the overlay
    loadingOverlay.style.display = 'flex';
    
    try {
        // Get non-voice employees
        let query = window.supabase
            .from('requests_users')
            .select('*')
            .eq('role', 'non-voice');

        const searchTerm = searchEmployees.value.trim();
        const statusFilter = filterEmployeeStatus.value;

        if (searchTerm) {
            query = query.or(`email.ilike.%${searchTerm}%,assignee.ilike.%${searchTerm}%`);
        }

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data: employees, error } = await query;

        if (error) throw error;

        // Get all requests to manually count assignments for each employee
        const { data: allRequests, error: requestsError } = await window.supabase
            .from('requests')
            .select('*');
            
        if (requestsError) throw requestsError;

        // Count open and closed requests for each employee
        const employeesWithStats = employees.map(employee => {
            // Filter requests assigned to this employee
            const employeeRequests = allRequests.filter(r => 
                r.non_voice_assignee === employee.assignee
            );
            
            const openRequests = employeeRequests.filter(r => 
                r.status === 'open' || r.status === 'in-progress'
            ).length;
            
            const closedRequests = employeeRequests.filter(r => 
                r.status === 'completed'
            ).length;
            
            // Calculate time in current status using updated_at
            let timeInStatus = '00:00:00';
            let statusTimestamp = employee.updated_at || null;
            
            if (statusTimestamp) {
                const statusTime = new Date(statusTimestamp);
                const now = new Date();
                const diffMs = now - statusTime;
                
                // Format as HH:MM:SS
                const diffSecs = Math.floor(diffMs / 1000);
                const hours = Math.floor(diffSecs / 3600);
                const minutes = Math.floor((diffSecs % 3600) / 60);
                const seconds = diffSecs % 60;
                
                timeInStatus = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            return {
                ...employee,
                openRequests,
                closedRequests,
                timeInStatus,
                statusTimestamp
            };
        });

        // Store employee data in localStorage for persistence
        localStorage.setItem('employeeStats', JSON.stringify(employeesWithStats.map(e => ({
            email: e.email,
            status: e.status,
            statusTimestamp: e.updated_at
        }))));

        employeesContainer.innerHTML = employeesWithStats.map(employee => {
            // Get initials for avatar
            const initials = employee.assignee
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();
                
            // Convert statuses that may be 'busy' or others to either 'ready' or 'break'
            const status = ['ready', 'break'].includes(employee.status) ? employee.status : 'ready';
                
            return `
                <div class="employee-card" data-email="${employee.email}">
                    <div class="employee-header">
                        <div class="employee-avatar">
                            ${initials}
                        </div>
                        <div class="employee-info">
                            <div class="employee-name">${employee.assignee}</div>
                            <div class="employee-email">${employee.email}</div>
                        </div>
                    </div>
                    <div class="flex items-center justify-center my-2">
                        <span class="status-badge ${status} px-3 py-1 rounded-full text-sm">
                            ${formatStatus(status)}
                        </span>
                    </div>
                    <div class="timer-display text-center my-2">
                        <div class="text-sm text-gray-500">Time in status</div>
                        <div class="timer-value font-mono text-lg" 
                             data-email="${employee.email}" 
                             data-timestamp="${employee.updated_at || ''}">
                            ${employee.timeInStatus}
                        </div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${employee.openRequests}</div>
                            <div class="stat-label">Open Requests</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${employee.closedRequests}</div>
                            <div class="stat-label">Completed</div>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button onclick="changeEmployeeStatus('${employee.email}', 'ready')" 
                            class="btn ${status === 'ready' ? 'btn-primary' : 'btn-outline-primary'} flex-1">
                            <i class="fas fa-check-circle mr-1"></i> Ready
                        </button>
                        <button onclick="changeEmployeeStatus('${employee.email}', 'break')" 
                            class="btn ${status === 'break' ? 'btn-primary' : 'btn-outline-primary'} flex-1">
                            <i class="fas fa-coffee mr-1"></i> Break
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Start timer updates
        startStatusTimers();
    } catch (error) {
        console.error('Error loading employees:', error);
        showError('Failed to load employees');
    } finally {
        // Hide loading overlay when done
        loadingOverlay.style.display = 'none';
    }
}

// Function to start timers for all employee status displays
function startStatusTimers() {
    // Clear any existing interval
    if (window.statusTimerInterval) {
        clearInterval(window.statusTimerInterval);
    }
    
    // Update all timers every second
    window.statusTimerInterval = setInterval(() => {
        const timerElements = document.querySelectorAll('.timer-value');
        timerElements.forEach(timerElement => {
            const timestamp = timerElement.getAttribute('data-timestamp');
            
            if (timestamp) {
                // If we have a status change timestamp, calculate the elapsed time
                const startTime = new Date(timestamp);
                const now = new Date();
                const diffMs = now - startTime;
                
                // Format as HH:MM:SS
                const diffSecs = Math.floor(diffMs / 1000);
                const hours = Math.floor(diffSecs / 3600);
                const minutes = Math.floor((diffSecs % 3600) / 60);
                const seconds = diffSecs % 60;
                
                timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                // Fall back to incrementing the current timer if no start time is available
                const currentTime = timerElement.textContent.trim();
                const [hours, minutes, seconds] = currentTime.split(':').map(Number);
                
                if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                    const totalSeconds = hours * 3600 + minutes * 60 + seconds + 1; // Add 1 for the next second
                    const newHours = Math.floor(totalSeconds / 3600);
                    const newMinutes = Math.floor((totalSeconds % 3600) / 60);
                    const newSeconds = totalSeconds % 60;
                    
                    timerElement.textContent = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')}`;
                }
            }
        });
    }, 1000);
}

async function changeEmployeeStatus(employeeEmail, newStatus) {
    const employeeCard = document.querySelector(`.employee-card[data-email="${employeeEmail}"]`);
    if (!employeeCard) return;
    
    // Show loading state on the card
    employeeCard.style.opacity = '0.7';
    employeeCard.style.pointerEvents = 'none';
    
    try {
        // Use current timestamp for the update
        const timestamp = new Date().toISOString();
        
        const { error } = await window.supabase
            .from('requests_users')
            .update({ 
                status: newStatus,
                updated_at: timestamp 
            })
            .eq('email', employeeEmail);
            
        if (error) throw error;
        
        // Update card status without reloading
        const statusBadge = employeeCard.querySelector('.status-badge');
        if (statusBadge) {
            statusBadge.className = `status-badge ${newStatus} px-3 py-1 rounded-full text-sm`;
            statusBadge.textContent = formatStatus(newStatus);
        }
        
        // Reset timer display and update the timestamp
        const timerDisplay = employeeCard.querySelector('.timer-value');
        if (timerDisplay) {
            timerDisplay.textContent = '00:00:00'; // Reset timer display
            timerDisplay.setAttribute('data-timestamp', timestamp); // Store new timestamp
        }
        
        // Update localStorage with the new status and timestamp
        const storedEmployees = JSON.parse(localStorage.getItem('employeeStats') || '[]');
        const updatedEmployees = storedEmployees.map(e => {
            if (e.email === employeeEmail) {
                return {
                    ...e,
                    status: newStatus,
                    statusTimestamp: timestamp
                };
            }
            return e;
        });
        localStorage.setItem('employeeStats', JSON.stringify(updatedEmployees));
        
        // Update action buttons
        const buttons = employeeCard.querySelectorAll('.action-buttons button');
        buttons.forEach(button => {
            const buttonStatus = button.textContent.trim().toLowerCase().includes('ready') ? 'ready' : 'break';
            
            if (buttonStatus === newStatus) {
                button.className = 'btn btn-primary flex-1';
            } else {
                button.className = 'btn btn-outline-primary flex-1';
            }
        });
        
        showSuccess(`Employee status updated to ${formatStatus(newStatus)}`);
    } catch (error) {
        console.error('Error updating employee status:', error);
        showError('Failed to update employee status');
    } finally {
        // Restore card appearance
        employeeCard.style.opacity = '1';
        employeeCard.style.pointerEvents = 'auto';
    }
}

// Helper function to format status text
function formatStatus(status) {
    switch (status) {
        case 'ready': return 'Ready';
        case 'break': return 'On Break';
        case 'active': return 'Active';
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
}

// UI Helpers
function switchTab(tabName) {
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName)
    })

    requestsTab.classList.toggle('hidden', tabName !== 'requests')
    employeesTab.classList.toggle('hidden', tabName !== 'employees')

    if (tabName === 'requests') {
        loadRequests()
    } else {
        loadEmployees()
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

// Helper function to highlight changed cells with a subtle animation
function highlightCell(cell) {
    cell.style.transition = 'background-color 0.5s ease';
    cell.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    setTimeout(() => {
        cell.style.backgroundColor = 'transparent';
    }, 1000);
} 
