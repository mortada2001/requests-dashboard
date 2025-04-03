// Global variables
let currentUser = null;
let employees = []; // Store employees for use in forms
let notificationsEnabled = true; // Default is notifications enabled

// DOM elements for statistics
const totalRequestsElement = document.getElementById('total-requests');
const openRequestsElement = document.getElementById('open-requests');
const inProgressRequestsElement = document.getElementById('in-progress-requests');
const completedRequestsElement = document.getElementById('completed-requests');
const readyUsersElement = document.getElementById('ready-users');
const breakUsersElement = document.getElementById('break-users');

// Initialize pagination state
let requestsState = {
    currentPage: 1,
    itemsPerPage: 100,
    totalItems: 0,
    filteredItems: [],
    sortOrder: 'newest'
};

// Document ready function
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkSession()
        await loadStatistics()
        await loadRequests()
        await loadEmployees()
        
        // Set up real-time subscriptions after initial data is loaded
        setupRealTimeSubscriptions()
        
        // Initialize employee view toggle
        initializeEmployeeView()
        
        // Set up auto-refresh for statistics
        setInterval(refreshStatistics, 30000) // Refresh every 30 seconds
        
        // Set up auto-refresh for employee cards
        setInterval(refreshEmployeeCards, 60000) // Refresh every minute
        
        // Add event listener for date filter
        document.getElementById('filter-date')?.addEventListener('change', debounce(loadRequests, 300));
    } catch (error) {
        console.error('Error initializing dashboard:', error)
        showError('Failed to initialize dashboard')
    }
})

// Set up real-time subscriptions for data changes
function setupRealTimeSubscriptions() {
    console.log("Setting up real-time subscriptions for admin dashboard");
    
    // Subscribe to employee status changes
    const employeeStatusSubscription = window.supabase
        .channel('admin-employee-status-changes')
        .on('postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'requests_users',
                filter: 'role=eq.non-voice'
            }, 
            async (payload) => {
                console.log('Employee status update received:', payload);
                
                if (!payload.new || !payload.new.email) {
                    console.log('Invalid payload received:', payload);
                    return;
                }
                
                const employeeEmail = payload.new.email;
                const newStatus = payload.new.status;
                const oldStatus = payload.old?.status;
                const timestamp = payload.new.updated_at || new Date().toISOString();
                
                console.log(`Status change detected: ${oldStatus} -> ${newStatus} for ${employeeEmail}`);
                
                // Immediately update the statistics
                if (oldStatus !== newStatus) {
                    // Fetch accurate count from database instead of trying to calculate locally
                    await updateEmployeeStatistics();
                }
                
                // Update both card and table row
                let updated = false;
                
                // Try to directly update the employee card
                const employeeCard = document.querySelector(`.employee-card[data-email="${employeeEmail}"]`);
                if (employeeCard) {
                    updated = updateEmployeeStatusCard(employeeEmail, newStatus, timestamp);
                }
                
                // Also update the table row if it exists
                const tableRow = document.querySelector(`#employees-table-body tr[data-email="${employeeEmail}"]`);
                if (tableRow) {
                    updateEmployeeTableRow(tableRow, newStatus, timestamp);
                    updated = true;
                }
                
                // If we're in table view and row doesn't exist yet, refresh the table
                const currentView = localStorage.getItem('employeeView') || 'card';
                if (currentView === 'table' && !tableRow) {
                    console.log('Table row not found, updating entire table');
                    updateEmployeeTable();
                }
                
                // If direct update fails, try to find and update the employee
                if (!updated) {
                    console.log(`Employee not found in DOM for ${employeeEmail}, refreshing employee list`);
                    loadEmployees();
                } else {
                    // Show notification if update was successful
                    const employeeName = payload.new.assignee || employeeEmail;
                    showEmployeeStatusUpdate(employeeName, newStatus);
                }
            }
        )
        .subscribe((status) => {
            console.log("Employee status subscription status:", status);
            
            if (status !== 'SUBSCRIBED') {
                console.warn(`Subscription status is ${status}, not SUBSCRIBED. Real-time updates may not work properly.`);
            }
            
            // Set up a periodic refresh as a fallback, but at a less frequent interval
            setInterval(() => {
                console.log("Periodic employee status check");
                // Always refresh the actual count during periodic check
                updateEmployeeStatistics();
                refreshEmployeeStatuses();
            }, 30000); // Check every 30 seconds
        });

    // Subscribe to request changes
    const requestsSubscription = window.supabase
        .channel('admin-request-changes')
        .on('postgres_changes',
            {
                event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'requests'
            },
            (payload) => {
                console.log('Request update received:', payload);
                // Refresh the requests
                loadRequests();
            }
        )
        .subscribe((status) => {
            console.log("Request subscription status:", status);
        });
}

// Function to update only employee statistics
async function updateEmployeeStatistics() {
    try {
        // Get a direct count of non-voice employees by status from the database
        const { data: employees, error } = await window.supabase
            .from('requests_users')
            .select('email, status')
            .eq('role', 'non-voice');
            
        if (error) throw error;
        
        // Count employees in each status
        const readyUsers = employees.filter(emp => emp.status === 'ready').length;
        const breakUsers = employees.filter(emp => emp.status === 'break').length;
        
        console.log(`Employee status count - Ready: ${readyUsers}, Break: ${breakUsers}`);
        
        // Update the employee status counts in the dashboard
        readyUsersElement.textContent = readyUsers || 0;
        breakUsersElement.textContent = breakUsers || 0;
    } catch (error) {
        console.error('Error updating employee statistics:', error);
    }
}

// Debounce helper function
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

// Load requests
async function loadRequests() {
    try {
        // Get UI filter values
        const searchTerm = document.getElementById('search-requests').value.trim();
        const statusFilter = document.getElementById('filter-status').value;
        const dateFilter = document.getElementById('filter-date').value;
        const sortOrder = document.getElementById('sort-order').value;

        // Save sort order state for use after filtering
        requestsState.sortOrder = sortOrder;

        // Build query with filters
        let query = window.supabase.from('requests').select('*');

        // Apply status filter if selected
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        // Apply date filter if selected
        if (dateFilter) {
            // Get the selected date in local timezone and convert to UTC for filtering
            const selectedDate = new Date(dateFilter);
            
            // Create date with time set to beginning of day in local timezone
            const localStartOfDay = new Date(selectedDate);
            localStartOfDay.setHours(0, 0, 0, 0);
            
            // Create date with time set to end of day in local timezone
            const localEndOfDay = new Date(selectedDate);
            localEndOfDay.setHours(23, 59, 59, 999);
            
            // Convert local times to UTC for database filtering
            const utcStartStr = localStartOfDay.toISOString();
            const utcEndStr = localEndOfDay.toISOString();
            
            // Log for debugging
            console.log(`Filtering requests for local date: ${dateFilter}`);
            console.log(`UTC time range: ${utcStartStr} to ${utcEndStr}`);
            
            // Filter by created_at within the selected day in local timezone
            query = query.gte('created_at', utcStartStr).lte('created_at', utcEndStr);
        }

        // Fetch data
        const { data: requests, error } = await query;

        if (error) throw error;

        // Apply search filter client-side
        let filteredRequests = requests;
        if (searchTerm) {
            // Check if search is a number (phone) or text (name)
            const isNumericSearch = /^\d+$/.test(searchTerm);
            
            if (isNumericSearch) {
                // Search for phone number - convert to string first to avoid TypeError
                filteredRequests = requests.filter(request => 
                    request.phone_number && String(request.phone_number).includes(searchTerm)
                );
            } else {
                // Search for customer name
                filteredRequests = requests.filter(request => 
                    request.customer_name && 
                    request.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
        }

        // Update state
        requestsState.filteredItems = filteredRequests;
        requestsState.totalItems = filteredRequests.length;
        
        // Sort based on user preference
        if (requestsState.sortOrder === 'newest') {
            requestsState.filteredItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else {
            requestsState.filteredItems.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        
        // Update pagination information
        const totalPages = Math.ceil(requestsState.totalItems / requestsState.itemsPerPage);
        
        // Ensure we don't exceed available pages
        if (requestsState.currentPage > totalPages) {
            requestsState.currentPage = Math.max(1, totalPages);
        }
        
        // Calculate pagination values
        const startIdx = (requestsState.currentPage - 1) * requestsState.itemsPerPage;
        const endIdx = Math.min(startIdx + requestsState.itemsPerPage, requestsState.totalItems);
        const paginatedItems = requestsState.filteredItems.slice(startIdx, endIdx);
        
        // Update pagination UI
        document.getElementById('showing-from').textContent = requestsState.totalItems ? startIdx + 1 : 0;
        document.getElementById('showing-to').textContent = endIdx;
        document.getElementById('total-filtered').textContent = requestsState.totalItems;
        document.getElementById('current-page').textContent = requestsState.currentPage;
        
        // Enable/disable pagination buttons
        document.getElementById('prev-page').disabled = requestsState.currentPage <= 1;
        document.getElementById('next-page').disabled = requestsState.currentPage >= totalPages;
        
        // Show total count
        document.getElementById('requests-count').textContent = `${requestsState.totalItems} requests`;
        
        // Render the paginated requests
        renderRequestsTable(paginatedItems);

        // Reset the search UI state after search is complete
        const searchInput = document.getElementById('search-requests');
        if (searchInput) {
            searchInput.classList.remove('searching');
        }
        
        // Also reset the refresh button to its default state
        const refreshButton = document.getElementById('refresh-requests');
        if (refreshButton && searchTerm.length > 0) {
            refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh';
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        alert('Failed to load requests');
        
        // Make sure we reset UI state even on error
        const searchInput = document.getElementById('search-requests');
        if (searchInput) {
            searchInput.classList.remove('searching');
        }
        
        const refreshButton = document.getElementById('refresh-requests');
        if (refreshButton) {
            refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh';
        }
    }
}

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
const employeeStatusFilter = document.getElementById('employee-status-filter')
const employeesContainer = document.getElementById('employees-container')

// Event Listeners
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
refreshRequestsButton.addEventListener('click', () => {
    // Add spinner to button for visual feedback
    const button = document.getElementById('refresh-requests');
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Refreshing...';

    // Refresh requests
    loadRequests();
    
    // Also refresh the statistics
    refreshStatistics();
    
    // Reset button after short delay
    setTimeout(() => {
        button.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh';
    }, 1000);
});
searchEmployees.addEventListener('input', debounce(loadEmployees, 300))
employeeStatusFilter.addEventListener('change', loadEmployees)

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
        // Get today's date range
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Get requests with various status filters
        const [
            { count: totalRequests },
            { count: openRequests },
            { count: inProgressRequests },
            { count: completedRequests },
            { count: readyUsers },
            { count: breakUsers }
        ] = await Promise.all([
            window.supabase.from('requests').select('*', { count: 'exact' })
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests').select('*', { count: 'exact' })
                .eq('status', 'open')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests').select('*', { count: 'exact' })
                .eq('status', 'in-progress')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests').select('*', { count: 'exact' })
                .or('status.eq.completed,status.eq.waiting-request,status.eq.request-issue')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests_users').select('*', { count: 'exact' }).eq('status', 'ready'),
            window.supabase.from('requests_users').select('*', { count: 'exact' }).eq('status', 'break')
        ])

        totalRequestsElement.textContent = totalRequests || 0
        openRequestsElement.textContent = openRequests || 0
        inProgressRequestsElement.textContent = inProgressRequests || 0
        completedRequestsElement.textContent = completedRequests || 0
        
        // Update the employee status counts
        readyUsersElement.textContent = readyUsers || 0
        breakUsersElement.textContent = breakUsers || 0
    } catch (error) {
        console.error('Error loading statistics:', error)
        showError('Failed to load statistics')
    } finally {
        hideLoading()
    }
}

function renderRequestsTable(requests) {
    const tableBody = document.getElementById('requests-table')
    
    if (!requests || requests.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-3"></i>
                    <p>No requests found</p>
                </td>
            </tr>
        `
        return
    }
    
    tableBody.innerHTML = requests.map(request => `
        <tr class="clickable-row animate-fade-in" onclick="toggleExpandedRow(this, '${request.id}')">
            <td class="font-medium text-gray-900">${request.customer_name || ''}</td>
            <td>${request.phone_number || ''}</td>
            <td>
                <span class="status-pill status-${request.status}">
                    <i class="fas fa-${getStatusIcon(request.status)}"></i>
                        ${formatRequestStatus(request.status)}
                    </span>
                </td>
            <td>${request.sales_assignee || ''}</td>
            <td>${request.assigned_to || ''}</td>
            <td>${formatDate(request.created_at)}</td>
            <td>
                <button 
                    onclick="event.stopPropagation(); openUpdateModal('${request.id}')" 
                    class="btn btn-update"
                >
                    <i class="fas fa-edit mr-1"></i>
                    Update
                    </button>
                </td>
            </tr>
        <tr class="expanded-content hidden" id="expanded-${request.id}">
            <td colspan="7">
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
}

// New helper function to format request status - use full proper status names
function formatRequestStatus(status) {
    switch (status) {
        case 'completed': return 'Done';
        case 'waiting-request': return 'Waiting Request';
        case 'request-issue': return 'Request Issue';
        case 'in-progress': return 'In Progress';
        case 'open': return 'Open';
        default: return status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

// Check a specific employee's status
async function checkEmployeeStatus(employeeEmail) {
    if (!employeeEmail) return;
    
    try {
        console.log(`Checking status for employee: ${employeeEmail}`);
        
        const { data, error } = await window.supabase
            .from('requests_users')
            .select('*')
            .eq('email', employeeEmail)
            .single();
            
        if (error) {
            console.error(`Error fetching status for ${employeeEmail}:`, error);
            return;
        }
        
        if (!data) {
            console.log(`No data found for employee ${employeeEmail}`);
            return;
        }
        
        const employeeCard = document.querySelector(`.employee-card[data-email="${employeeEmail}"]`);
        if (!employeeCard) {
            console.log(`No card found for employee ${employeeEmail}`);
            return;
        }
        
        // Update card UI based on status
        const statusBadge = employeeCard.querySelector('.status-badge');
        const currentStatus = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
        const newStatus = data.status || 'ready';
        
        if (formatStatus(newStatus).toLowerCase() !== currentStatus.toLowerCase()) {
            console.log(`Status update needed for ${data.assignee}: ${currentStatus} -> ${newStatus}`);
            
            // Update status badge
            if (statusBadge) {
                const displayStatus = ['ready', 'break'].includes(newStatus) ? newStatus : 'ready';
                statusBadge.className = `status-badge ${displayStatus} px-3 py-1 rounded-full text-sm`;
                statusBadge.textContent = formatStatus(displayStatus);
            }
            
            // Update timer display
            const timerDisplay = employeeCard.querySelector('.timer-value');
            if (timerDisplay) {
                timerDisplay.textContent = '00:00:00';
                timerDisplay.setAttribute('data-timestamp', data.updated_at || '');
            }
            
            // Update buttons
            const buttons = employeeCard.querySelectorAll('.action-buttons button');
            buttons.forEach(button => {
                const buttonStatus = button.textContent.trim().toLowerCase().includes('ready') ? 'ready' : 'break';
                
                if (buttonStatus === newStatus) {
                    button.className = 'btn btn-primary flex-1';
                } else {
                    button.className = 'btn btn-outline-primary flex-1';
                }
            });
            
            return true; // Status was updated
        } else {
            console.log(`Status is current for ${data.assignee}: ${currentStatus}`);
            return false; // No update needed
        }
    } catch (err) {
        console.error(`Error checking employee status for ${employeeEmail}:`, err);
        return false;
    }
}

// Employee Management
async function loadEmployees() {
    console.log('Loading employees with simplified approach...');
    
    // Reset any previously loaded state to prevent duplicates
    const cardsContainer = document.getElementById('employees-card-container');
    const tableBody = document.getElementById('employees-table-body');
    
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (tableBody) tableBody.innerHTML = '';
    
    try {
        // Show loading state
        document.body.classList.add('loading-data');
        
        // Get filter values
        const searchQuery = document.getElementById('search-employees')?.value?.toLowerCase().trim() || '';
        const statusFilter = document.getElementById('employee-status-filter')?.value || '';
        
        console.log(`Fetching employees with search: "${searchQuery}", filter: "${statusFilter}"`);
        
        // Fetch employees
        let query = supabase
            .from('requests_users')
            .select('*')
            .eq('role', 'non-voice');
        
        // Apply status filter if needed
        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }
        
        const { data: employees, error } = await query;
        
        if (error) throw error;
        
        // Process the results - ensure uniqueness by email and apply search filter
        const uniqueEmployees = [];
        const processedEmails = new Set();
        
        if (employees && employees.length > 0) {
            employees.forEach(emp => {
                // Skip if already processed or missing email
                if (!emp.email || processedEmails.has(emp.email)) return;
                
                // Apply search filter
                if (searchQuery) {
                    const matchesSearch = 
                        (emp.assignee?.toLowerCase().includes(searchQuery)) || 
                        (emp.email?.toLowerCase().includes(searchQuery));
                    
                    if (!matchesSearch) return;
                }
                
                // Add to unique list
                processedEmails.add(emp.email);
                uniqueEmployees.push(emp);
            });
        }
        
        console.log(`Found ${uniqueEmployees.length} unique employees after filtering`);
        
        // Display "no results" message if needed
        if (uniqueEmployees.length === 0) {
            const noResultsMessage = `
                No employees found${searchQuery ? ' matching "' + searchQuery + '"' : ''}
                ${statusFilter && statusFilter !== 'all' ? ' with status ' + formatStatus(statusFilter) : ''}.
            `;
            
            if (cardsContainer) {
                cardsContainer.innerHTML = `<div class="alert alert-info">${noResultsMessage}</div>`;
            }
            
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">${noResultsMessage}</td></tr>`;
            }
            
            return;
        }
        
        // Determine current view
        const currentView = localStorage.getItem('employeeView') || 'card';
        
        // Render appropriate view
        if (currentView === 'card') {
            await renderEmployeeCards(uniqueEmployees, cardsContainer);
        } else {
            renderEmployeeTable(uniqueEmployees, tableBody);
        }
        
        // Start status timer
        startStatusTimer();
        
    } catch (error) {
        console.error('Error loading employees:', error);
        
        // Show error message
        const errorMessage = 'Failed to load employees. Please try again.';
        
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div class="alert alert-danger">${errorMessage}</div>`;
        }
        
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${errorMessage}</td></tr>`;
        }
    } finally {
        // Reset loading state
        document.body.classList.remove('loading-data');
    }
}

// New helper function to render employee cards
async function renderEmployeeCards(employees, container) {
    if (!container || !employees || !employees.length) return;
    
    try {
        // Create a fragment to batch DOM operations
        const fragment = document.createDocumentFragment();
        
        // Create all cards first
        const cardPromises = employees.map(employee => createEmployeeCard(employee));
        const cards = await Promise.all(cardPromises);
        
        // Add valid cards to fragment
        cards.forEach(card => {
            if (card) fragment.appendChild(card);
        });
        
        // Clear container and add all cards at once
        container.innerHTML = '';
        container.appendChild(fragment);
        
        console.log(`Rendered ${cards.filter(Boolean).length} employee cards`);
    } catch (error) {
        console.error('Error rendering employee cards:', error);
        container.innerHTML = '<div class="alert alert-danger">Error rendering employee cards</div>';
    }
}

// New helper function to render employee table
function renderEmployeeTable(employees, tableBody) {
    if (!tableBody || !employees || !employees.length) return;
    
    try {
        // Create a fragment to batch DOM operations
        const fragment = document.createDocumentFragment();
        
        // Create a row for each employee
        employees.forEach(employee => {
            const row = document.createElement('tr');
            row.setAttribute('data-email', employee.email);
            
            // Get status display
            const status = employee.status || 'ready';
            const statusText = formatStatus(status).toUpperCase();
            const timestamp = employee.updated_at || '';
            
            // Set row content
            row.innerHTML = `
                <td class="align-middle">${employee.assignee || 'Unknown'}</td>
                <td class="align-middle text-center">
                    <span class="status-badge ${status} px-3 py-1 rounded-full text-sm">
                        ${statusText}
                    </span>
                </td>
                <td class="align-middle text-center"><strong>2</strong></td>
                <td class="align-middle text-center"><strong>6</strong></td>
                <td class="align-middle text-center">
                    <span class="timer-value" data-timestamp="${timestamp}">00:00:00</span>
                </td>
                <td class="align-middle text-center">
                    <div class="d-flex justify-content-center gap-2">
                        <button onclick="changeEmployeeStatus('${employee.email}', 'ready')" 
                            class="btn btn-sm ${status === 'ready' ? 'btn-primary' : 'btn-outline-primary'}">
                            Set Ready
                        </button>
                        <button onclick="changeEmployeeStatus('${employee.email}', 'break')" 
                            class="btn btn-sm ${status === 'break' ? 'btn-primary' : 'btn-outline-primary'}">
                            Set Break
                        </button>
                    </div>
                </td>
            `;
            
            fragment.appendChild(row);
        });
        
        // Clear table body and add all rows at once
        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
        
        console.log(`Rendered ${employees.length} employee table rows`);
    } catch (error) {
        console.error('Error rendering employee table:', error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-danger">Error rendering table</td></tr>';
    }
}

// Function to start timers for all employee status displays
function startStatusTimer() {
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
    if (!employeeEmail || !newStatus) return;
    
    console.log(`Changing status for ${employeeEmail} to ${newStatus}`);
    
    // Find the employee element
    const employeeCard = document.querySelector(`.employee-card[data-email="${employeeEmail}"]`);
    const tableRow = document.querySelector(`#employees-table-body tr[data-email="${employeeEmail}"]`);
    
    // Mark as updating (visual feedback)
    if (employeeCard) {
        employeeCard.classList.add('updating');
        
        // Add loading overlay
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
        employeeCard.appendChild(overlay);
    }
    
    if (tableRow) {
        tableRow.classList.add('updating');
    }
    
    try {
        // First, get the current status from the database to ensure accuracy
        const { data: currentUserData, error: fetchError } = await window.supabase
            .from('requests_users')
            .select('status')
            .eq('email', employeeEmail)
            .single();
            
        if (fetchError) throw fetchError;
        
        const oldStatus = currentUserData.status || 'offline';
        
        // Skip update if the status is already the same
        if (oldStatus === newStatus) {
            console.log(`Employee ${employeeEmail} is already in ${newStatus} status, skipping update`);
            if (employeeCard) {
                employeeCard.classList.remove('updating');
                const existingOverlay = employeeCard.querySelector('.loading-overlay');
                if (existingOverlay) existingOverlay.remove();
            }
            if (tableRow) {
                tableRow.classList.remove('updating');
            }
            return;
        }
        
        // Immediately update the statistics without waiting for server response
        if (oldStatus !== newStatus) {
            // Get the current counts
            let readyCount = parseInt(readyUsersElement.textContent) || 0;
            let breakCount = parseInt(breakUsersElement.textContent) || 0;
            
            // Update counts based on status change direction
            if (oldStatus === 'ready' && newStatus === 'break') {
                readyCount = Math.max(0, readyCount - 1);
                breakCount += 1;
            } else if (oldStatus === 'break' && newStatus === 'ready') {
                breakCount = Math.max(0, breakCount - 1);
                readyCount += 1;
            } else if (oldStatus !== 'ready' && oldStatus !== 'break' && newStatus === 'ready') {
                // Coming from another status to ready
                readyCount += 1;
            } else if (oldStatus !== 'ready' && oldStatus !== 'break' && newStatus === 'break') {
                // Coming from another status to break
                breakCount += 1;
            } else if (oldStatus === 'ready' && newStatus !== 'ready' && newStatus !== 'break') {
                // Leaving ready to a status other than break
                readyCount = Math.max(0, readyCount - 1);
            } else if (oldStatus === 'break' && newStatus !== 'ready' && newStatus !== 'break') {
                // Leaving break to a status other than ready
                breakCount = Math.max(0, breakCount - 1);
            }
            
            console.log(`Updating status counts - Ready: ${readyCount}, Break: ${breakCount}`);
            
            // Update the display
            readyUsersElement.textContent = readyCount;
            breakUsersElement.textContent = breakCount;
        }
        
        // Update in database
        const { error: updateError } = await window.supabase
            .from('requests_users')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('email', employeeEmail);
            
        if (updateError) throw updateError;
        
        console.log(`Status updated successfully for ${employeeEmail}`);
        
        // Also update the status display in the card/table
        if (employeeCard) {
            const statusBadge = employeeCard.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `status-badge ${newStatus} px-3 py-1 rounded-full text-sm`;
                statusBadge.textContent = formatStatus(newStatus);
            }
            
            // Update buttons
            const buttons = employeeCard.querySelectorAll('button');
            buttons.forEach(button => {
                if (button.textContent.toLowerCase().includes('ready')) {
                    button.className = `btn ${newStatus === 'ready' ? 'btn-primary' : 'btn-outline-primary'} flex-1`;
                } else if (button.textContent.toLowerCase().includes('break')) {
                    button.className = `btn ${newStatus === 'break' ? 'btn-primary' : 'btn-outline-primary'} flex-1`;
                }
            });
        }
        
        if (tableRow) {
            const statusCell = tableRow.querySelector('td:nth-child(2)');
            if (statusCell) {
                const statusBadge = statusCell.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.className = `status-badge ${newStatus} px-3 py-1 rounded-full text-sm`;
                    statusBadge.textContent = formatStatus(newStatus).toUpperCase();
                }
            }
            
            // Update buttons
            const buttons = tableRow.querySelectorAll('button');
            buttons.forEach(button => {
                if (button.textContent.includes('Ready')) {
                    button.className = `btn btn-sm ${newStatus === 'ready' ? 'btn-primary' : 'btn-outline-primary'}`;
                } else if (button.textContent.includes('Break')) {
                    button.className = `btn btn-sm ${newStatus === 'break' ? 'btn-primary' : 'btn-outline-primary'}`;
                }
            });
        }
        
        // Get the employee name for the notification
        let employeeName = employeeEmail;
        if (employeeCard) {
            const nameElement = employeeCard.querySelector('.employee-name');
            if (nameElement) {
                employeeName = nameElement.textContent;
            }
        }
        
        // Show a success message
        showSuccess(`${employeeName}'s status updated to ${formatStatus(newStatus)}`);
        
        // Fetch accurate employee statistics after update
        await updateEmployeeStatistics();
        
    } catch (error) {
        console.error('Error updating employee status:', error);
        showError('Failed to update status');
        
        // Ensure we update statistics in case of error
        updateEmployeeStatistics();
    } finally {
        // Remove updating state
        if (employeeCard) {
            employeeCard.classList.remove('updating');
            const overlay = employeeCard.querySelector('.loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
        
        if (tableRow) {
            tableRow.classList.remove('updating');
        }
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

// Show loading animation
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
        document.body.classList.add('loading');
        
        // Ensure the spinner animation is working
        const spinner = loadingElement.querySelector('.loading-spinner');
        if (spinner) {
            // Force spinner animation by resetting it
            spinner.style.animation = 'none';
            spinner.offsetHeight; // Trigger reflow
            spinner.style.animation = 'spin 1s linear infinite';
        }
    }
}

// Hide loading animation
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        // Fade out with transition
        loadingElement.style.opacity = '0';
        
        // After transition, hide completely
        setTimeout(() => {
            loadingElement.style.display = 'none';
            loadingElement.style.opacity = '1';
            document.body.classList.remove('loading');
        }, 300);
    }
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

// Toggle expanded row function
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

// Open update modal
async function openUpdateModal(requestId) {
    try {
        // Get request data and non-voice employees in parallel
        const [requestResult, employeesResult] = await Promise.all([
            window.supabase
                .from('requests')
                .select('*')
                .eq('id', requestId)
                .single(),
            window.supabase
                .from('requests_users')
                .select('assignee, email')
                .eq('role', 'non-voice')
        ]);

        if (requestResult.error) throw requestResult.error;
        if (employeesResult.error) throw employeesResult.error;

        const request = requestResult.data;
        const nonVoiceEmployees = employeesResult.data;

        // Create and show modal
        const modalHTML = `
            <div id="update-modal" class="modal">
                <div class="modal-content animate-slide-in">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold text-gray-900">Update Request</h3>
                        <button type="button" onclick="closeModal()" class="text-gray-400 hover:text-gray-500">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <form id="update-form">
                        <input type="hidden" id="request-id" value="${requestId}">
                        
                        <div class="form-group mb-4">
                            <label class="form-label" for="assigned-to">
                                <i class="fas fa-user text-gray-400 mr-2"></i>
                                Assigned To
                            </label>
                            <select id="assigned-to" class="form-input w-full" onkeyup="filterAssigneeOptions(this)">
                                <option value="">-- Not Assigned --</option>
                                ${nonVoiceEmployees.map(emp => `
                                    <option value="${emp.assignee}" 
                                        ${emp.assignee === request.assigned_to ? 'selected' : ''}>
                                        ${emp.assignee}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        ${request.non_voice_notes ? `
                            <div class="form-group mb-4">
                                <label class="form-label" for="non-voice-notes">
                                    <i class="fas fa-note-sticky text-gray-400 mr-2"></i>
                                    Non-Voice Notes
                                </label>
                                <textarea id="non-voice-notes" class="form-input w-full" rows="3">${request.non_voice_notes}</textarea>
                            </div>
                        ` : `
                            <div class="text-gray-500 italic mb-4">
                                <i class="fas fa-info-circle mr-2"></i>
                                No non-voice notes available yet
                            </div>
                        `}
                        
                        <div class="flex justify-end space-x-2 mt-6">
                            <button type="button" onclick="confirmDeleteRequest('${requestId}')" class="btn btn-danger">
                                <i class="fas fa-trash-alt mr-2"></i>
                                Delete Request
                            </button>
                            <button type="button" onclick="closeModal()" class="btn btn-secondary">
                                <i class="fas fa-times mr-2"></i>
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save mr-2"></i>
                                Update
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add modal to the DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        // Add event listener to form
        document.getElementById('update-form').addEventListener('submit', handleUpdateSubmit);
        
        // Add click event to close modal when clicking outside
        const modal = document.getElementById('update-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Initialize select2 for searchable dropdown
        $(document).ready(function() {
            $('#assigned-to').select2({
                width: '100%',
                placeholder: 'Search and select employee...',
                allowClear: true
            });
        });

    } catch (error) {
        console.error('Error loading request:', error);
        showError('Failed to load request details');
    }
}

// Function to execute the delete request
async function executeDeleteRequest(requestId) {
    try {
        const { error } = await window.supabase
            .from('requests')
            .delete()
            .eq('id', requestId);

        if (error) throw error;

        // Close all modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.remove());

        // Refresh the requests table
        loadRequests();
        
        // Show success message
        showSuccess('Request deleted successfully');
    } catch (error) {
        console.error('Error deleting request:', error);
        showError('Failed to delete request');
    }
}

// Function to filter assignee options as user types
function filterAssigneeOptions(selectElement) {
    const searchText = selectElement.value.toLowerCase();
    const options = selectElement.options;

    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const text = option.text.toLowerCase();
        
        // Skip the "Not Assigned" option
        if (i === 0) continue;
        
        // Show/hide options based on search text
        if (text.includes(searchText)) {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
    }
}

// Handle update form submission
async function handleUpdateSubmit(e) {
    e.preventDefault();
    
    const requestId = document.getElementById('request-id').value;
    const assignedTo = document.getElementById('assigned-to').value;
    const nonVoiceNotes = document.getElementById('non-voice-notes')?.value;

    try {
        const updateData = {
            assigned_to: assignedTo || null,
            updated_at: new Date().toISOString()
        };

        // Only include non_voice_notes if the textarea exists (meaning there were existing notes)
        if (document.getElementById('non-voice-notes')) {
            updateData.non_voice_notes = nonVoiceNotes;
        }

        const { error } = await window.supabase
            .from('requests')
            .update(updateData)
            .eq('id', requestId);

        if (error) throw error;

        closeModal();
        loadRequests(); // Refresh the table
        
        showSuccess('Request updated successfully');
    } catch (error) {
        console.error('Error updating request:', error);
        showError('Failed to update request: ' + error.message);
    }
}

// Show a notification
function showNotification(message, type = 'info') {
    // Don't show notifications if they're disabled
    if (!notificationsEnabled) {
        console.log('Notification suppressed:', message);
        return;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-info'}`;
    
    // Set icon based on type
    let icon;
    if (type === 'success') icon = 'check-circle';
    else if (type === 'danger') icon = 'exclamation-circle';
    else icon = 'info-circle';
    
    notification.innerHTML = `
        <div class="notification-title">
            <i class="fas fa-${icon}"></i>
            ${type === 'success' ? 'Success' : type === 'danger' ? 'Error' : 'Information'}
        </div>
        <p class="notification-message">${message}</p>
        <button class="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onclick="this.parentNode.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Check if notification container exists
    let container = document.getElementById('notification-container');
    if (!container) {
        // Create the container if it doesn't exist
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-[9999] w-[350px] pointer-events-auto';
        document.body.appendChild(container);
    }
    
    // Add to container
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Show a notification when an employee's status changes
function showEmployeeStatusUpdate(employeeName, status) {
    // Don't show notifications if they're disabled
    if (!notificationsEnabled) {
        console.log('Notification suppressed:', employeeName, status);
        return;
    }
    
    // Prevent duplicate notifications within a short time window
    const notificationKey = `${employeeName}_${status}_${new Date().getTime()}`;
    
    // Check if we've shown this notification recently (within last 2 seconds)
    if (window.recentNotifications && window.recentNotifications.has(notificationKey.split('_').slice(0, 2).join('_'))) {
        console.log('Preventing duplicate notification:', notificationKey);
        return;
    }
    
    // Track this notification
    if (!window.recentNotifications) {
        window.recentNotifications = new Set();
    }
    
    const baseKey = notificationKey.split('_').slice(0, 2).join('_');
    window.recentNotifications.add(baseKey);
    
    // Auto-clear notification tracking after a delay
    setTimeout(() => {
        if (window.recentNotifications) {
            window.recentNotifications.delete(baseKey);
        }
    }, 2000);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification employee-status-update';
    
    // Set icon and color based on status
    let icon, color, statusText;
    
    if (status === 'ready') {
        icon = 'check-circle';
        color = 'green';
        statusText = 'Ready';
    } else if (status === 'break') {
        icon = 'coffee';
        color = 'orange';
        statusText = 'Break';
    } else {
        icon = 'circle';
        color = 'blue';
        statusText = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    notification.innerHTML = `
        <div class="notification-title">
            <i class="fas fa-${icon} text-${color}-500"></i>
            Status Update
        </div>
        <p class="notification-message">
            <strong>${employeeName}</strong> changed status to <strong>${statusText}</strong>
        </p>
        <button class="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onclick="this.parentNode.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Check if notification container exists
    let container = document.getElementById('notification-container');
    if (!container) {
        // Create the container if it doesn't exist
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-[9999] w-[350px] pointer-events-auto';
        document.body.appendChild(container);
    }
    
    // Add to container
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Refresh employee statuses without reloading the whole page
async function refreshEmployeeStatuses() {
    try {
        console.log("Refreshing employee statuses...");
        
        // Fetch the latest employee data
        const { data, error } = await window.supabase
            .from('requests_users')
            .select('*')
            .eq('role', 'non-voice');
            
        if (error) {
            console.error('Error fetching employee statuses:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log("No employee data returned from query");
            return;
        }
        
        console.log(`Found ${data.length} employees to update`);
        
        let updatesApplied = 0;
        const updatedEmails = new Set(); // Track which employees were updated
        
        // Get the current view
        const currentView = localStorage.getItem('employeeView') || 'card';
        
        // Update each employee card if it exists
        data.forEach(employee => {
            const email = employee.email;
            if (!email) return;
            
            let updated = false;
            
            // Check and update the card view
            const employeeCard = document.querySelector(`.employee-card[data-email="${email}"]`);
            if (employeeCard) {
                // Check if status is different from what's displayed in the UI
                const statusBadge = employeeCard.querySelector('.status-badge');
                const currentStatus = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
                const newStatus = employee.status || 'ready'; // Default to ready if null
                
                // Only update if status has changed
                if (formatStatus(newStatus).toLowerCase() !== currentStatus.toLowerCase()) {
                    console.log(`Status changed for ${employee.assignee}: ${currentStatus} -> ${newStatus}`);
                    
                    if (updateEmployeeStatusCard(email, newStatus, employee.updated_at)) {
                        updatesApplied++;
                        updatedEmails.add(email);
                        updated = true;
                    }
                }
            }
            
            // Check and update the table view
            const tableRow = document.querySelector(`#employees-table-body tr[data-email="${email}"]`);
            if (tableRow) {
                // Check if status is different from what's displayed in the UI
                const statusBadge = tableRow.querySelector('.status-badge');
                const currentStatus = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
                const newStatus = employee.status || 'ready'; // Default to ready if null
                
                // Only update if status has changed
                if (formatStatus(newStatus).toLowerCase() !== currentStatus.toLowerCase()) {
                    if (updateEmployeeTableRow(tableRow, newStatus, employee.updated_at)) {
                        updatesApplied++;
                        updatedEmails.add(email);
                        updated = true;
                    }
                }
            }
            
            // If we updated something, show notification
            if (updated) {
                showEmployeeStatusUpdate(employee.assignee, employee.status);
            }
        });
        
        // If we're in table view and made updates, consider regenerating the table
        if (currentView === 'table' && updatesApplied > 0) {
            console.log(`Applied ${updatesApplied} updates to the UI. Consider refreshing table view.`);
            // Only regenerate the whole table if we've done multiple updates to keep it in sync
            if (updatesApplied > 2) {
                updateEmployeeTable();
            }
        }
        
        console.log(`Status refresh complete. Applied ${updatesApplied} updates.`);
    } catch (err) {
        console.error('Error in refreshEmployeeStatuses:', err);
    }
}

function toggleNotifications() {
    notificationsEnabled = !notificationsEnabled;
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
    updateNotificationToggleUI();
}

function updateNotificationToggleUI() {
    const toggleBtn = document.getElementById('toggle-notifications');
    if (!toggleBtn) return;
    
    const statusSpan = toggleBtn.querySelector('span');
    if (statusSpan) {
        statusSpan.textContent = notificationsEnabled ? 'Notifications: On' : 'Notifications: Off';
    }
    
    // Update button styling - simple and clean
    if (notificationsEnabled) {
        toggleBtn.innerHTML = `<i class="fas fa-bell mr-2 text-blue-500"></i>Notifications: On`;
        toggleBtn.classList.remove('text-gray-500');
        toggleBtn.classList.add('text-blue-600');
    } else {
        toggleBtn.innerHTML = `<i class="fas fa-bell-slash mr-2 text-gray-400"></i>Notifications: Off`;
        toggleBtn.classList.remove('text-blue-600');
        toggleBtn.classList.add('text-gray-500');
    }
}

// Directly update an employee's status card
function updateEmployeeStatusCard(employeeEmail, newStatus, timestamp) {
    if (!employeeEmail || !newStatus) return false;
    
    const employeeCard = document.querySelector(`.employee-card[data-email="${employeeEmail}"]`);
    if (!employeeCard) {
        console.log(`Cannot update status - no card found for ${employeeEmail}`);
        return false;
    }
    
    try {
        console.log(`Directly updating status card for ${employeeEmail} to ${newStatus}`);
        
        // Get the employee name for notification
        const nameElement = employeeCard.querySelector('.employee-name');
        const employeeName = nameElement ? nameElement.textContent : 'Employee';
        
        // Update status badge
        const statusBadge = employeeCard.querySelector('.status-badge');
        if (statusBadge) {
            const displayStatus = ['ready', 'break'].includes(newStatus) ? newStatus : 'ready';
            statusBadge.className = `status-badge ${displayStatus} px-3 py-1 rounded-full text-sm`;
            statusBadge.textContent = formatStatus(displayStatus);
        }
        
        // Update timer
        const timerDisplay = employeeCard.querySelector('.timer-value');
        if (timerDisplay) {
            timerDisplay.textContent = '00:00:00';
            if (timestamp) {
                timerDisplay.setAttribute('data-timestamp', timestamp);
            } else {
                timerDisplay.setAttribute('data-timestamp', new Date().toISOString());
            }
        }
        
        // Update buttons
        const buttons = employeeCard.querySelectorAll('.action-buttons button');
        buttons.forEach(button => {
            const buttonStatus = button.textContent.trim().toLowerCase().includes('ready') ? 'ready' : 'break';
            
            if (buttonStatus === newStatus) {
                button.className = 'btn btn-primary flex-1';
            } else {
                button.className = 'btn btn-outline-primary flex-1';
            }
        });
        
        // Show notification
        showEmployeeStatusUpdate(employeeName, newStatus);
        
        return true;
    } catch (err) {
        console.error(`Error updating employee status card for ${employeeEmail}:`, err);
        return false;
    }
}

// Function to create employee card
async function createEmployeeCard(employee) {
    if (!employee || !employee.email) {
        console.error("Invalid employee data:", employee);
        return createErrorCard("Invalid employee data");
    }
    
    try {
        // Create the card element
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.setAttribute('data-email', employee.email);

        // Get today's date boundaries for proper filtering
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        // Create a Date object for the next day
        const nextDay = new Date(today);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];
        
        console.log(`Fetching today's completed tasks for ${employee.assignee}, range: ${todayStr} to (excluding) ${nextDayStr}`);
        
        // Get today's date boundaries for proper filtering in local timezone
        const localStartOfDay = new Date(today);
        localStartOfDay.setHours(0, 0, 0, 0);
        const localEndOfDay = new Date(today);
        localEndOfDay.setHours(23, 59, 59, 999);

        // Convert to ISO strings for database queries
        const utcStartStr = localStartOfDay.toISOString();
        const utcEndStr = localEndOfDay.toISOString();

        console.log(`Fetching today's completed tasks for ${employee.assignee}`);
        console.log(`Local day: ${today.toLocaleDateString()}, UTC range: ${utcStartStr} to ${utcEndStr}`);
        
        // Get tasks counts in parallel to improve performance
        const [assignedResult, completedResult] = await Promise.all([
            // Get assigned requests count
            window.supabase
                .from('requests')
                .select('*', { count: 'exact' })
                .eq('assigned_to', employee.assignee)
                .eq('status', 'in-progress'),
                
            // Get completed requests count from today only in local timezone
            window.supabase
                .from('requests')
                .select('*', { count: 'exact' })
                .eq('assigned_to', employee.assignee)
                .or('status.eq.completed,status.eq.waiting-request,status.eq.request-issue')
                .gte('updated_at', utcStartStr)
                .lte('updated_at', utcEndStr)
        ]);

        // Set counts, default to 0 if errors
        const currentTasks = assignedResult.error ? 0 : (assignedResult.count || 0);
        const completedTasks = completedResult.error ? 0 : (completedResult.count || 0);
        
        console.log(`Employee ${employee.assignee}: Current tasks = ${currentTasks}, Completed today = ${completedTasks}`);

        // Get status and icon
        const status = employee.status || 'ready';
        const statusIcon = status === 'ready' ? 'check-circle' : status === 'break' ? 'coffee' : 'circle';

        // Build card HTML
        card.innerHTML = `
            <div class="employee-header">
                <div class="employee-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="employee-info">
                    <h3 class="employee-name">${employee.assignee || 'Unknown'}</h3>
                    <p class="employee-email">${employee.email}</p>
                </div>
            </div>
            
            <div class="status-row">
                <span class="status-badge ${status} px-3 py-1 rounded-full text-sm">
                    <i class="fas fa-${statusIcon} mr-1"></i>${formatStatus(status)}
                </span>
                <span class="timer-value" data-timestamp="${employee.updated_at || ''}">${'00:00:00'}</span>
            </div>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-icon">
                        <i class="fas fa-tasks text-blue-500"></i>
                    </div>
                    <div class="stat-value current-tasks">${currentTasks}</div>
                    <div class="stat-label">Current Tasks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-icon">
                        <i class="fas fa-check-circle text-green-500"></i>
                    </div>
                    <div class="stat-value completed-tasks">${completedTasks}</div>
                    <div class="stat-label">Done Today</div>
                </div>
            </div>
            
            <div class="action-buttons">
                <button onclick="changeEmployeeStatus('${employee.email}', 'ready')" 
                        class="btn ${status === 'ready' ? 'btn-primary' : 'btn-outline-primary'} flex-1">
                    <i class="fas fa-check-circle mr-1"></i>
                    Ready
                </button>
                <button onclick="changeEmployeeStatus('${employee.email}', 'break')"
                        class="btn ${status === 'break' ? 'btn-primary' : 'btn-outline-primary'} flex-1">
                    <i class="fas fa-coffee mr-1"></i>
                    Break
                </button>
            </div>
        `;

        return card;
    } catch (error) {
        console.error(`Error creating card for ${employee?.email || 'unknown'}:`, error);
        return createErrorCard(`Error loading data for ${employee?.assignee || employee?.email || 'employee'}`);
    }
}

// Helper to create an error card when employee card creation fails
function createErrorCard(errorMessage) {
    const errorCard = document.createElement('div');
    errorCard.className = 'employee-card error';
    errorCard.innerHTML = `
        <div class="text-center p-4 text-red-500">
            <i class="fas fa-exclamation-circle mb-2 text-2xl"></i>
            <p>${errorMessage}</p>
        </div>
    `;
    return errorCard;
}

// Function to update employee table data
function updateEmployeeTable() {
    try {
        const tableBody = document.getElementById('employees-table-body');
        const tableContainer = document.getElementById('employees-table-container');
        
        if (!tableBody) {
            console.error('Employee table body not found');
            return;
        }
        
        // Add smooth transition
        if (tableContainer) {
            tableContainer.style.opacity = '0.7';
        }
        
        // Clear existing rows
        const currentRows = tableBody.innerHTML;
        const newFragment = document.createDocumentFragment();
        
        // Get all employee cards
        const employeeCards = document.querySelectorAll('.employee-card');
        if (!employeeCards.length) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No employees found</td></tr>';
            
            // Restore opacity after update
            if (tableContainer) {
                setTimeout(() => {
                    tableContainer.style.opacity = '1';
                }, 100);
            }
            return;
        }
        
        // Create a row for each employee
        employeeCards.forEach(card => {
            try {
                if (card.classList.contains('error')) {
                    // Skip error cards
                    return;
                }
                
                const row = document.createElement('tr');
                
                // Get data from card
                const email = card.getAttribute('data-email');
                if (!email) {
                    console.warn('Employee card missing email attribute:', card);
                    return;
                }
                
                const name = card.querySelector('.employee-name')?.textContent || 'Unknown';
                const statusBadge = card.querySelector('.status-badge');
                const status = statusBadge ? statusBadge.className.split(' ')[1] : 'unknown';
                const statusText = statusBadge ? formatStatus(status).toUpperCase() : 'UNKNOWN';
                const currentTasks = card.querySelector('.current-tasks')?.textContent || '0';
                const completedTasks = card.querySelector('.completed-tasks')?.textContent || '0';
                const timerValue = card.querySelector('.timer-value')?.textContent || '00:00:00';
                const timestamp = card.querySelector('.timer-value')?.getAttribute('data-timestamp') || '';
                
                // Set data attribute for the row
                row.setAttribute('data-email', email);
                
                // Add cells to the row
                row.innerHTML = `
                    <td class="align-middle">${name}</td>
                    <td class="align-middle text-center">
                        <span class="status-badge ${status} px-3 py-1 rounded-full text-sm">
                            ${statusText}
                        </span>
                    </td>
                    <td class="align-middle text-center"><strong>${currentTasks}</strong></td>
                    <td class="align-middle text-center"><strong>${completedTasks}</strong></td>
                    <td class="align-middle text-center">
                        <span class="timer-value" data-timestamp="${timestamp}">${timerValue}</span>
                    </td>
                    <td class="align-middle text-center">
                        <div class="d-flex justify-content-center gap-2">
                            <button onclick="changeEmployeeStatus('${email}', 'ready')" 
                                class="btn btn-sm ${status === 'ready' ? 'btn-primary' : 'btn-outline-primary'}">
                                Set Ready
                            </button>
                            <button onclick="changeEmployeeStatus('${email}', 'break')" 
                                class="btn btn-sm ${status === 'break' ? 'btn-primary' : 'btn-outline-primary'}">
                                Set Break
                            </button>
                        </div>
                    </td>
                `;
                
                
                newFragment.appendChild(row);
            } catch (err) {
                console.error('Error creating table row from card:', err, card);
            }
        });
        
        // Apply changes with a smooth transition
        setTimeout(() => {
            // Replace with new rows
            tableBody.innerHTML = '';
            tableBody.appendChild(newFragment);
            
            // Restore opacity with a slight delay
            if (tableContainer) {
                setTimeout(() => {
                    tableContainer.style.opacity = '1';
                }, 100);
            }
            
            console.log(`Employee table updated with ${tableBody.children.length} rows`);
        }, 150);
        
    } catch (error) {
        console.error('Error updating employee table:', error);
    }
}

// Initialize the view when the page loads
function initializeEmployeeView() {
    console.log('Initializing employee view...');
    
    // Get saved preference or default to 'card'
    const savedView = localStorage.getItem('employeeView') || 'card';
    
    // Set up event listener for the view switch
    const viewSwitch = document.getElementById('view-switch');
    if (viewSwitch) {
        // Set initial state based on saved preference
        viewSwitch.checked = savedView === 'table';
        
        // Add change event listener
        viewSwitch.addEventListener('change', function() {
            switchEmployeeView(this.checked ? 'table' : 'card');
        });
    }
    
    // Switch to the saved view
    switchEmployeeView(savedView);
    
    console.log(`Initialized employee view to: ${savedView}`);
}

// Function to switch between card and table view for employees
function switchEmployeeView(view) {
    console.log(`Switching to ${view} view`);
    
    // Save preference
    localStorage.setItem('employeeView', view);
    
    // Get elements
    const cardView = document.getElementById('employees-card-container');
    const tableView = document.getElementById('employees-table-container');
    const viewSwitch = document.getElementById('view-switch');
    
    if (!cardView || !tableView) {
        console.error('View containers not found');
        return;
    }
    
    // Set the switch state
    if (viewSwitch) {
        viewSwitch.checked = view === 'table';
    }
    
    // Transition smoothly between views
    if (view === 'card') {
        // First make table invisible but keep layout
        tableView.style.opacity = '0';
        
        // After a short delay, switch display properties
        setTimeout(() => {
            cardView.style.display = 'grid';
            cardView.style.opacity = '0';
            tableView.style.display = 'none';
            
            // Force reflow
            void cardView.offsetWidth;
            
            // Fade in the card view
            cardView.style.opacity = '1';
        }, 150);
    } else {
        // First make cards invisible but keep layout
        cardView.style.opacity = '0';
        
        // After a short delay, switch display properties
        setTimeout(() => {
            tableView.style.display = 'block';
            tableView.style.opacity = '0';
            cardView.style.display = 'none';
            
            // Update table data before showing
            updateEmployeeTable();
            
            // Force reflow
            void tableView.offsetWidth;
            
            // Fade in the table view
            tableView.style.opacity = '1';
        }, 150);
    }
}

// Function to update a single row in the employee table
function updateEmployeeTableRow(tableRow, newStatus, timestamp) {
    if (!tableRow || !newStatus) {
        console.error('Missing required parameters for updateEmployeeTableRow');
        return false;
    }
    
    try {
        console.log(`Updating table row for status: ${newStatus}`);
        
        // Add visual feedback
        tableRow.classList.add('updating');
        
        // Update status badge
        const statusBadge = tableRow.querySelector('.status-badge');
        if (statusBadge) {
            // Remove all status classes and add the new one
            statusBadge.classList.remove('ready', 'break', 'unknown');
            statusBadge.classList.add(newStatus);
            statusBadge.textContent = formatStatus(newStatus).toUpperCase();
        }
        
        // Update the timer
        const timerElement = tableRow.querySelector('.timer-value');
        if (timerElement) {
            timerElement.textContent = '00:00:00';
            timerElement.setAttribute('data-timestamp', timestamp);
        }
        
        // Update the buttons
        const readyBtn = tableRow.querySelector('button[onclick*="ready"]');
        const breakBtn = tableRow.querySelector('button[onclick*="break"]');
        
        if (readyBtn) {
            if (newStatus === 'ready') {
                readyBtn.classList.remove('btn-outline-primary');
                readyBtn.classList.add('btn-primary');
            } else {
                readyBtn.classList.remove('btn-primary');
                readyBtn.classList.add('btn-outline-primary');
            }
        }
        
        if (breakBtn) {
            if (newStatus === 'break') {
                breakBtn.classList.remove('btn-outline-primary');
                breakBtn.classList.add('btn-primary');
            } else {
                breakBtn.classList.remove('btn-primary');
                breakBtn.classList.add('btn-outline-primary');
            }
        }
        
        // Add a subtle highlight effect
        tableRow.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        setTimeout(() => {
            tableRow.style.backgroundColor = '';
            tableRow.classList.remove('updating');
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('Error updating employee table row:', error);
        tableRow.classList.remove('updating');
        return false;
    }
}

// Function to refresh statistics without full reload
async function refreshStatistics() {
    try {
        // Get today's date range
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Get requests with various status filters
        const [
            { count: totalRequests },
            { count: openRequests },
            { count: inProgressRequests },
            { count: completedRequests }
        ] = await Promise.all([
            window.supabase.from('requests').select('*', { count: 'exact' })
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests').select('*', { count: 'exact' })
                .eq('status', 'open')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests').select('*', { count: 'exact' })
                .eq('status', 'in-progress')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString()),
            window.supabase.from('requests').select('*', { count: 'exact' })
                .or('status.eq.completed,status.eq.waiting-request,status.eq.request-issue')
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString())
        ]);

        // Animate count transitions
        animateCounterValue(totalRequestsElement, parseInt(totalRequestsElement.textContent) || 0, totalRequests || 0);
        animateCounterValue(openRequestsElement, parseInt(openRequestsElement.textContent) || 0, openRequests || 0);
        animateCounterValue(inProgressRequestsElement, parseInt(inProgressRequestsElement.textContent) || 0, inProgressRequests || 0);
        animateCounterValue(completedRequestsElement, parseInt(completedRequestsElement.textContent) || 0, completedRequests || 0);
        
        console.log('Statistics refreshed dynamically');
    } catch (error) {
        console.error('Error refreshing statistics:', error);
    }
}

// Function to animate a counter value
function animateCounterValue(element, startValue, endValue, duration = 800) {
    if (!element) return;
    
    // Don't animate if values are the same
    if (startValue === endValue) return;
    
    const difference = endValue - startValue;
    const startTime = performance.now();
    
    // Use requestAnimationFrame for smooth animation
    function updateCounter(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing function for smoother animation
        const easedProgress = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 3);
        
        // Calculate current value
        const currentValue = Math.floor(startValue + difference * easedProgress);
        
        // Update element
        element.textContent = currentValue;
        
        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Add a function to refresh employee cards with proper filtering
async function refreshEmployeeCards() {
    try {
        console.log('Refreshing employee cards...');
        
        // Get the container
        const container = document.getElementById('employees-card-container');
        const tableBody = document.getElementById('employees-table-body');
        
        if (!container && !tableBody) {
            console.warn('Employee containers not found');
            return;
        }
        
        // Only refresh if employee tab is visible
        if (employeesTab.classList.contains('hidden')) {
            console.log('Employee tab not visible, skipping refresh');
            return;
        }
        
        // Reload employees
        await loadEmployees();
        
        console.log('Employee cards refreshed');
    } catch (error) {
        console.error('Error refreshing employee cards:', error);
    }
}

// Update the refresh button event handler
document.getElementById('refresh-employees')?.addEventListener('click', async () => {
    // Visual feedback
    const button = document.getElementById('refresh-employees');
    if (button) {
        button.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-1"></i> Refreshing...';
        button.disabled = true;
    }
    
    // Refresh employee cards
    await refreshEmployeeCards();
    
    // Reset button
    if (button) {
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Refresh';
            button.disabled = false;
        }, 1000);
    }
});

// Add auto-refresh for employee cards
setInterval(refreshEmployeeCards, 60000); // Refresh every minute

// Close modal
function closeModal() {
    const modal = document.getElementById('update-modal');
    if (modal) {
        // Add fade out animation
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        
        // Remove after animation completes
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
}


