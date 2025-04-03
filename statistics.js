// Initialize Supabase client
const supabaseUrl = 'https://pdcssepqmgzpkayzfqta.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkY3NzZXBxbWd6cGtheXpmcXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MzczMjksImV4cCI6MjA1NjQxMzMyOX0.NqN7b7itdA8Tz0sG4fzSI4Y19P5syYFWnmKwANbH1IY'
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

// Chart.js configuration
Chart.register(ChartDataLabels)

// Global variables for charts
let statusDistributionChart
let hourlyVolumeChart
let slaGauge
let responseTimeGauge
let resolutionTimeGauge
let customerSatisfactionGauge
let employeeDailyChart
let employeeStatusChart

// SLA threshold in minutes
const SLA_THRESHOLD_MINUTES = 15

// Initialize charts
function initializeCharts() {
    // Status Distribution Chart
    const statusCtx = document.getElementById('status-distribution-chart').getContext('2d')
    statusDistributionChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Open', 'In Progress', 'Done'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#F59E0B', '#3B82F6', '#10B981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                datalabels: {
                    color: 'white',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        }
    })
    
    // Store the chart reference globally for updates
    window.statusDistChart = statusDistributionChart;

    // Hourly Volume Chart
    const volumeCtx = document.getElementById('hourly-volume-chart').getContext('2d')
    hourlyVolumeChart = new Chart(volumeCtx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Requests',
                data: Array(24).fill(0),
                backgroundColor: '#3B82F6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    })
    
    // Store the chart reference globally for updates
    window.hourlyVolumeChart = hourlyVolumeChart;

    // Initialize gauges
    initializeGauges()
    
    // Initialize data for charts right away
    updateChartsData();
}

// Initialize gauge charts
function initializeGauges() {
    const gaugeOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '80%',
        rotation: -90,
        circumference: 180,
        plugins: {
            legend: {
                display: false
            }
        }
    }

    // SLA Gauge
    const slaCtx = document.getElementById('sla-gauge').getContext('2d')
    slaGauge = new Chart(slaCtx, {
        type: 'doughnut',
        data: {
            labels: ['SLA'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#10B981', '#E5E7EB'],
                borderWidth: 0
            }]
        },
        options: {
            ...gaugeOptions,
            title: {
                display: true,
                text: 'SLA',
                position: 'bottom'
            }
        }
    })

    // Response Time Gauge
    const responseCtx = document.getElementById('response-time-gauge').getContext('2d')
    responseTimeGauge = new Chart(responseCtx, {
        type: 'doughnut',
        data: {
            labels: ['Response Time'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#3B82F6', '#E5E7EB'],
                borderWidth: 0
            }]
        },
        options: {
            ...gaugeOptions,
            title: {
                display: true,
                text: 'Response Time',
                position: 'bottom'
            }
        }
    })

    // Resolution Time Gauge
    const resolutionCtx = document.getElementById('resolution-time-gauge').getContext('2d')
    resolutionTimeGauge = new Chart(resolutionCtx, {
        type: 'doughnut',
        data: {
            labels: ['Resolution Time'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#F59E0B', '#E5E7EB'],
                borderWidth: 0
            }]
        },
        options: {
            ...gaugeOptions,
            title: {
                display: true,
                text: 'Resolution Time',
                position: 'bottom'
            }
        }
    })

    // Customer Satisfaction Gauge
    const satisfactionCtx = document.getElementById('customer-satisfaction-gauge').getContext('2d')
    customerSatisfactionGauge = new Chart(satisfactionCtx, {
        type: 'doughnut',
        data: {
            labels: ['Satisfaction'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#8B5CF6', '#E5E7EB'],
                borderWidth: 0
            }]
        },
        options: {
            ...gaugeOptions,
            title: {
                display: true,
                text: 'Customer Satisfaction',
                position: 'bottom'
            }
        }
    })
}

// Update gauge value
function updateGauge(chart, value, maxValue = 100) {
    const percentage = (value / maxValue) * 100
    chart.data.datasets[0].data = [percentage, 100 - percentage]
    chart.update()
}

// Get active date filter range
function getActiveDateFilter() {
    const filterType = document.getElementById('date-filter').value;
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastMonthStart = new Date(today);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    
    // If we have a custom date, parse it
    if (filterType === 'custom') {
        const customDate = document.getElementById('custom-date').value;
        if (customDate) {
            const selectedDate = new Date(customDate);
            selectedDate.setHours(0, 0, 0, 0);
            
            const nextDay = new Date(selectedDate);
            nextDay.setDate(nextDay.getDate() + 1);
            
            return {
                startDate: selectedDate,
                endDate: nextDay,
                label: selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            };
        }
    }
    
    // Return date range based on selected filter
    switch (filterType) {
        case 'today':
            return {
                startDate: today,
                endDate: tomorrow,
                label: 'Today'
            };
        case 'yesterday':
            return {
                startDate: yesterday,
                endDate: today,
                label: 'Yesterday'
            };
        case 'last7days':
            return {
                startDate: lastWeekStart,
                endDate: tomorrow,
                label: 'Last 7 Days'
            };
        case 'lastmonth':
            return {
                startDate: lastMonthStart,
                endDate: tomorrow,
                label: 'Last 30 Days'
            };
        default:
            return {
                startDate: today,
                endDate: tomorrow,
                label: 'Today'
            };
    }
}

// Add date filter UI to dashboard
function addDateFilterUI() {
    // Create the date filter container
    const filterContainer = document.createElement('div');
    filterContainer.className = 'bg-white rounded-lg shadow-sm p-4 mb-6 animate-fade-in';
    filterContainer.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-4">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                <i class="fas fa-calendar-alt text-blue-500 mr-2"></i>
                Date Filter
            </h3>
            <div class="flex flex-wrap items-center gap-3">
                <select id="date-filter" class="form-select rounded-md border-gray-300 shadow-sm text-sm px-3 py-2">
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7days">Last 7 Days</option>
                    <option value="lastmonth">Last 30 Days</option>
                    <option value="custom">Custom Date</option>
                </select>
                <div id="custom-date-container" class="hidden">
                    <input type="date" id="custom-date" class="form-input rounded-md border-gray-300 shadow-sm text-sm px-3 py-2">
                </div>
                <button id="apply-date-filter" class="btn-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded px-3 py-2 flex items-center">
                    <i class="fas fa-filter mr-1"></i> Apply Filter
                </button>
            </div>
        </div>
    `;
    
    // Insert after the navigation bar
    const mainContent = document.querySelector('main');
    mainContent.insertBefore(filterContainer, mainContent.firstChild);
    
    // Setup event listeners
    document.getElementById('date-filter').addEventListener('change', function() {
        const customDateContainer = document.getElementById('custom-date-container');
        customDateContainer.classList.toggle('hidden', this.value !== 'custom');
    });
    
    document.getElementById('apply-date-filter').addEventListener('click', async function() {
        await refreshDashboardWithDateFilter();
    });
    
    // Set current date as default for custom date picker
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('custom-date').value = formattedDate;
}

// Refresh all dashboard data using the selected date filter
async function refreshDashboardWithDateFilter() {
    try {
        // Show loading
        showLoading();
        
        // Get the active date filter
        const dateFilter = getActiveDateFilter();
        
        // Update the dashboard title with the date filter
        updateDashboardTitle(dateFilter.label);
        
        // Refresh all dashboard data
        await Promise.all([
            loadTodayStats(), // Will use the date filter
            loadEmployeePerformance(), // Will use the date filter
            loadOverdueRequests(), // Will use the date filter
            updateChartsData() // Will use the date filter
        ]);
        
        // Refresh currently selected employee if any
        const selectedEmployee = document.getElementById('employee-select').value;
        if (selectedEmployee) {
            await showEmployeeDetails(selectedEmployee);
        }
        
        // Show notification
        showNotification(`Statistics updated for ${dateFilter.label}`, 'success');
        
        // Hide loading
        hideLoading();
    } catch (error) {
        console.error('Error refreshing dashboard with date filter:', error);
        showNotification('Error updating statistics', 'error');
        hideLoading();
    }
}

// Update dashboard title with date filter
function updateDashboardTitle(dateLabel) {
    const dashboardTitle = document.querySelector('nav h1');
    if (dashboardTitle) {
        dashboardTitle.textContent = `Statistics Dashboard - ${dateLabel}`;
    }
}

// Load today's statistics
async function loadTodayStats() {
    try {
        // Get the active date filter
        const dateFilter = getActiveDateFilter();
        const startDate = dateFilter.startDate;
        const endDate = dateFilter.endDate;
        
        // Get previous date for comparison
        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        
        const previousEndDate = new Date(endDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        
        // Get the selected date's requests
        const { data: filteredRequests, error: currentError } = await supabaseClient
            .from('requests')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lt('created_at', endDate.toISOString());
            
        if (currentError) throw currentError;
        
        // Get previous period's requests
        const { data: previousRequests, error: previousError } = await supabaseClient
            .from('requests')
            .select('*')
            .gte('created_at', previousStartDate.toISOString())
            .lt('created_at', previousEndDate.toISOString());
            
        if (previousError) throw previousError;
        
        // Get active employees
        const { data: employees, error: employeeError } = await supabaseClient
            .from('requests_users')
            .select('*')
            .eq('role', 'non-voice');
            
        if (employeeError) throw employeeError;
        
        // Calculate statistics
        
        // 1. Count current period's requests
        const currentRequestsCount = filteredRequests.length;
        
        // 2. Calculate request trend vs previous period
        const previousRequestsCount = previousRequests.length;
        const requestTrend = previousRequestsCount > 0 
            ? ((currentRequestsCount - previousRequestsCount) / previousRequestsCount) * 100 
            : 0;
            
        // 3. Calculate SLA compliance for current period
        let withinSLACount = 0;
        let responseTimes = [];
        
        filteredRequests.forEach(request => {
            if (request.first_response_time) {
                // Use assigned_at if available, otherwise use created_at
                const startTime = request.assigned_at 
                    ? new Date(request.assigned_at) 
                    : new Date(request.created_at);
                const responseTime = new Date(request.first_response_time);
                const diffMinutes = (responseTime - startTime) / 60000;
                
                responseTimes.push(diffMinutes);
                
                if (diffMinutes <= SLA_THRESHOLD_MINUTES) {
                    withinSLACount++;
                }
            }
        });
        
        const slaRate = responseTimes.length > 0 
            ? (withinSLACount / responseTimes.length) * 100 
            : 100;
            
        // 4. Calculate average response time
        const avgResponseTime = responseTimes.length > 0 
            ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length) 
            : 0;
            
        // 5. Calculate response time trend
        let previousResponseTimes = [];
        
        previousRequests.forEach(request => {
            if (request.first_response_time) {
                const startTime = request.assigned_at 
                    ? new Date(request.assigned_at) 
                    : new Date(request.created_at);
                const responseTime = new Date(request.first_response_time);
                const diffMinutes = (responseTime - startTime) / 60000;
                
                previousResponseTimes.push(diffMinutes);
            }
        });
        
        const previousAvgResponseTime = previousResponseTimes.length > 0 
            ? Math.round(previousResponseTimes.reduce((sum, time) => sum + time, 0) / previousResponseTimes.length) 
            : 0;
            
        const responseTimeTrend = previousAvgResponseTime > 0 
            ? ((avgResponseTime - previousAvgResponseTime) / previousAvgResponseTime) * 100 
            : 0;
            
        // 6. Count active employees
        const readyEmployees = employees.filter(e => e.status === 'ready').length;
        const breakEmployees = employees.filter(e => e.status === 'break').length;
        
        // Get current values for animation
        const currentRequests = parseInt(document.getElementById('today-requests').textContent) || 0;
        const currentSla = parseFloat(document.getElementById('today-sla').textContent) || 0;
        const currentAvgResponse = parseInt(document.getElementById('avg-response-time').textContent) || 0;
        
        // Update UI with animations
        animateValue(document.getElementById('today-requests'), currentRequests, currentRequestsCount, 1000);
        
        // Update trend indicator with proper class
        const requestTrendEl = document.getElementById('today-requests-trend');
        if (requestTrendEl) {
            // Format trend percentage
            const trendValue = Math.abs(Math.round(requestTrend));
            requestTrendEl.innerHTML = `
                <i class="fas fa-arrow-${requestTrend >= 0 ? 'up' : 'down'} mr-1"></i>
                ${trendValue}%
            `;
            
            // Update class based on trend direction
            // For requests, more requests isn't necessarily good or bad
            // So we'll use neutral coloring - just show the direction
            requestTrendEl.className = requestTrend >= 0 
                ? 'trend-indicator trend-up' 
                : 'trend-indicator trend-down';
                
            // Add animation for significant changes
            if (Math.abs(requestTrend) > 20) {
                requestTrendEl.classList.add('animate-pulse');
                setTimeout(() => {
                    requestTrendEl.classList.remove('animate-pulse');
                }, 2000);
            }
        }
        
        // Animate SLA rate
        animateValue(document.getElementById('today-sla'), currentSla, Math.round(slaRate), 1000, '%');
        
        // Animate SLA bar
        animateWidth(document.getElementById('sla-bar'), Math.round(slaRate));
        
        // Animate response time
        animateValue(document.getElementById('avg-response-time'), currentAvgResponse, avgResponseTime, 1000, 'm');
        
        // Update response time trend - SIGN FLIPPED since for response time, LOWER is BETTER
        const responseTimeTrendEl = document.getElementById('response-time-trend');
        if (responseTimeTrendEl) {
            // Format trend percentage
            const trendValue = Math.abs(Math.round(responseTimeTrend));
            
            // For response time, UP is BAD (red), DOWN is GOOD (green)
            // So we need to flip the colors compared to normal metrics
            responseTimeTrendEl.innerHTML = `
                <i class="fas fa-arrow-${responseTimeTrend >= 0 ? 'up' : 'down'} mr-1"></i>
                ${trendValue}%
            `;
            
            // Flip the class assignment - trend-up means it's worse (red), trend-down means it's better (green)
            responseTimeTrendEl.className = responseTimeTrend >= 0 
                ? 'trend-indicator trend-down' // Red for increased response time (bad)
                : 'trend-indicator trend-up';  // Green for decreased response time (good)
                
            // Add animation for significant changes
            if (Math.abs(responseTimeTrend) > 10) {
                responseTimeTrendEl.classList.add('animate-pulse');
                setTimeout(() => {
                    responseTimeTrendEl.classList.remove('animate-pulse');
                }, 2000);
            }
        }
        
        // Update active employees count
        document.getElementById('active-employees').textContent = `${readyEmployees + breakEmployees}/${employees.length}`;
        document.getElementById('ready-employees').textContent = readyEmployees;
        document.getElementById('break-employees').textContent = breakEmployees;
        
        // Update SLA trend indicator if we have one
        const slaTrendEl = document.getElementById('sla-trend');
        if (slaTrendEl) {
            // Calculate SLA trend (this period vs last period)
            const previousSLA = previousResponseTimes.length > 0 
                ? (previousResponseTimes.filter(time => time <= SLA_THRESHOLD_MINUTES).length / previousResponseTimes.length) * 100 
                : 100;
            
            const currentSLA = responseTimes.length > 0 
                ? (withinSLACount / responseTimes.length) * 100 
                : 100;
            
            const slaTrend = previousSLA > 0 
                ? ((currentSLA - previousSLA) / previousSLA) * 100 
                : 0;
            
            // Format trend percentage
            const trendValue = Math.abs(Math.round(slaTrend));
            slaTrendEl.innerHTML = `
                <i class="fas fa-arrow-${slaTrend >= 0 ? 'up' : 'down'} mr-1"></i>
                ${trendValue}%
            `;
            
            // Update class based on trend direction
            // For SLA, UP is GOOD (green), DOWN is BAD (red)
            slaTrendEl.className = slaTrend >= 0 
                ? 'trend-indicator trend-up'   // Green for increased SLA (good)
                : 'trend-indicator trend-down'; // Red for decreased SLA (bad)
                
            // Add animation for significant changes
            if (Math.abs(slaTrend) > 10) {
                slaTrendEl.classList.add('animate-pulse');
                setTimeout(() => {
                    slaTrendEl.classList.remove('animate-pulse');
                }, 2000);
            }
        }
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        showNotification('Error loading statistics data', 'error');
    }
}

// Animate width changes with smooth transition
function animateWidth(element, targetWidth) {
    if (!element) return;
    
    // Get current width
    const currentWidth = parseFloat(element.style.width || '0');
    
    // Set up transition if not already set
    if (!element.style.transition) {
        element.style.transition = 'width 1s ease-in-out';
    }
    
    // Store start time and duration
    const startTime = performance.now();
    const duration = 1000; // 1 second
    
    // Create animation function
    const animateProgress = (timestamp) => {
        // Calculate elapsed time
        const elapsed = timestamp - startTime;
        
        // Calculate progress (0 to 1)
        const progress = Math.min(elapsed / duration, 1);
        
        // Calculate current width based on progress
        const newWidth = currentWidth + ((targetWidth - currentWidth) * progress);
        
        // Set new width
        element.style.width = `${newWidth}%`;
        
        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animateProgress);
        }
    };
    
    // Start animation
    requestAnimationFrame(animateProgress);
}

// Load employee performance
async function loadEmployeePerformance() {
    try {
        // Get non-voice employees
        const { data: employees, error: empError } = await supabaseClient
            .from('requests_users')
            .select('*')
            .eq('role', 'non-voice');
            
        if (empError) throw empError;
        
        // Get date filter range (overrides time-period dropdown)
        const dateFilter = getActiveDateFilter();
        
        // Get all requests within the specified date range
        const { data: requests, error: reqError } = await supabaseClient
            .from('requests')
            .select('*')
            .gte('created_at', dateFilter.startDate.toISOString())
            .lt('created_at', dateFilter.endDate.toISOString());
            
        if (reqError) throw reqError;
        
        // Calculate employee metrics
        const employeeMetrics = employees.map(employee => {
            // Filter requests assigned to this employee
            const employeeRequests = requests.filter(r => r.assigned_to === employee.assignee);
            
            // Calculate performance metrics
            let totalRequests = employeeRequests.length;
            
            // Count all completed statuses (completed, request-issue, waiting-request)
            let completedRequests = employeeRequests.filter(r => 
                r.status === 'completed' || 
                r.status === 'request-issue' || 
                r.status === 'waiting-request'
            ).length;
            
            // Count in-progress requests
            let inProgressRequests = employeeRequests.filter(r => r.status === 'in-progress').length;
            
            // Count open requests
            let openRequests = employeeRequests.filter(r => r.status === 'open').length;
            
            let responseTimeTotal = 0;
            let responseTimeCount = 0;
            let withinSLACount = 0;
            
            // Calculate response times
            employeeRequests.forEach(request => {
                if (request.first_response_time) {
                    // Use assigned_at if available, otherwise use created_at
                    const startTime = request.assigned_at 
                        ? new Date(request.assigned_at) 
                        : new Date(request.created_at);
                        
                    const responseTime = new Date(request.first_response_time);
                    const diffMinutes = (responseTime - startTime) / 60000;
                    
                    responseTimeTotal += diffMinutes;
                    responseTimeCount++;
                    
                    if (diffMinutes <= SLA_THRESHOLD_MINUTES) {
                        withinSLACount++;
                    }
                }
            });
            
            // Calculate metrics
            const avgResponseTime = responseTimeCount > 0 
                ? Math.round(responseTimeTotal / responseTimeCount) 
                : 0;
                
            const slaRate = responseTimeCount > 0 
                ? Math.round((withinSLACount / responseTimeCount) * 100) 
                : 100;
            
            return {
                ...employee,
                avgResponseTime,
                slaRate,
                completedRequests,
                inProgressRequests,
                openRequests,
                totalRequests,
                // Add metrics object for backwards compatibility with showEmployeeDetails
                metrics: {
                    total: totalRequests,
                    completed: completedRequests,
                    slaRate: slaRate,
                    avgResponseTime: avgResponseTime,
                    responseTimeData: []
                }
            };
        });
        
        // Sort by SLA compliance (best first)
        employeeMetrics.sort((a, b) => b.slaRate - a.slaRate);
        
        // Store metrics data globally for use in showEmployeeDetails
        window.employeeMetricsData = employeeMetrics;
        
        // Update the employee performance container with animation
        updateEmployeePerformance(employeeMetrics);
        
        // Populate employee selector
        populateEmployeeSelector(employeeMetrics);
        
    } catch (error) {
        console.error('Error loading employee performance:', error);
        showNotification('Error loading employee data', 'error');
    }
}

// Helper function to get start date based on selected period
function getStartDateForPeriod(period) {
    const now = new Date();
    switch (period) {
        case 'today':
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
            
        case 'week':
            const week = new Date();
            week.setDate(week.getDate() - 7);
            return week;
            
        case 'month':
            const month = new Date();
            month.setMonth(month.getMonth() - 1);
            return month;
            
        default:
            const defaultDate = new Date();
            defaultDate.setHours(0, 0, 0, 0);
            return defaultDate;
    }
}

// Update employee performance cards with animation
function updateEmployeePerformance(employees) {
    const container = document.getElementById('employee-performance');
    if (!container) return;
    
    // Store previous values for animation
    const previousValues = {};
    Array.from(container.children).forEach(card => {
        const email = card.getAttribute('data-email');
        if (email) {
            const responseTimeEl = card.querySelector('.avg-response-time');
            const slaRateEl = card.querySelector('.sla-rate');
            const completedRequestsEl = card.querySelector('.completed-requests');
            const inProgressEl = card.querySelector('.in-progress-count');
            
            if (responseTimeEl) previousValues[`${email}-responseTime`] = parseInt(responseTimeEl.textContent) || 0;
            if (slaRateEl) previousValues[`${email}-slaRate`] = parseInt(slaRateEl.textContent) || 0;
            if (completedRequestsEl) previousValues[`${email}-completed`] = parseInt(completedRequestsEl.textContent) || 0;
            if (inProgressEl) previousValues[`${email}-inProgress`] = parseInt(inProgressEl.textContent) || 0;
        }
    });
    
    // Clear container and prepare to show real data
    container.innerHTML = '';
    
    // Add updated employee cards
    employees.forEach(employee => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.setAttribute('data-email', employee.email);
        
        // Determine responsive time color based on value
        let responseTimeColor = 'text-green-600';
        if (employee.avgResponseTime > SLA_THRESHOLD_MINUTES) {
            responseTimeColor = 'text-red-600';
        } else if (employee.avgResponseTime > SLA_THRESHOLD_MINUTES * 0.7) {
            responseTimeColor = 'text-amber-500';
        }
        
        // Determine SLA rate color
        let slaColor = 'text-red-600';
        if (employee.slaRate >= 90) {
            slaColor = 'text-green-600';
        } else if (employee.slaRate >= 70) {
            slaColor = 'text-amber-500';
        }
        
        // Use employee.name or fallback to employee.assignee
        const displayName = employee.name || employee.assignee || 'Unknown';
        
        card.innerHTML = `
            <div class="flex items-center mb-4">
                <div class="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold">
                    ${displayName.charAt(0)}
                </div>
                <div class="ml-3">
                    <h4 class="text-lg font-medium">${displayName}</h4>
                    <p class="text-sm text-gray-500">${employee.email}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-3 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-500">Avg Response</p>
                    <p class="avg-response-time text-lg font-semibold ${responseTimeColor}">${employee.avgResponseTime}m</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">SLA Rate</p>
                    <p class="sla-rate text-lg font-semibold ${slaColor}">${employee.slaRate}%</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Completed</p>
                    <p class="completed-requests text-lg font-semibold">${employee.completedRequests}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm text-gray-500">In Progress</p>
                    <p class="in-progress-count text-lg font-semibold text-amber-500">${employee.inProgressRequests}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-500">Total Assigned</p>
                    <p class="text-lg font-semibold">${employee.totalRequests}</p>
                </div>
            </div>
            
            <div class="mt-4">
                <button 
                    onclick="showEmployeeDetails('${employee.email}')" 
                    class="w-full text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 px-3 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center">
                    <i class="fas fa-chart-bar mr-2"></i> Show Detailed Analytics
                </button>
            </div>
        `;
        
        container.appendChild(card);
        
        // Animate values with smooth transitions
        setTimeout(() => {
            // Get references to elements that need animation
            const responseTimeEl = card.querySelector('.avg-response-time');
            const slaRateEl = card.querySelector('.sla-rate');
            const completedRequestsEl = card.querySelector('.completed-requests');
            const inProgressEl = card.querySelector('.in-progress-count');
            
            // Get previous values or use current as defaults
            const prevResponseTime = previousValues[`${employee.email}-responseTime`] || employee.avgResponseTime;
            const prevSlaRate = previousValues[`${employee.email}-slaRate`] || employee.slaRate;
            const prevCompleted = previousValues[`${employee.email}-completed`] || employee.completedRequests;
            const prevInProgress = previousValues[`${employee.email}-inProgress`] || employee.inProgressRequests;
            
            // Animate value transitions
            animateValue(responseTimeEl, prevResponseTime, employee.avgResponseTime, 1000, 'm');
            animateValue(slaRateEl, prevSlaRate, employee.slaRate, 1000, '%');
            animateValue(completedRequestsEl, prevCompleted, employee.completedRequests, 1000);
            animateValue(inProgressEl, prevInProgress, employee.inProgressRequests, 1000);
        }, 100);
    });
}

// Animate a numeric value change
function animateValue(element, start, end, duration, suffix = '') {
    if (!element) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = `${value}${suffix}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Populate the employee selector dropdown
function populateEmployeeSelector(employees) {
    const selector = document.getElementById('employee-select')
    if (!selector) return
    
    // Clear existing options except the first one
    while (selector.options.length > 1) {
        selector.remove(1)
    }
    
    // Add employee options
    employees.forEach(employee => {
        const option = document.createElement('option')
        option.value = employee.email
        option.textContent = employee.assignee || employee.name
        selector.appendChild(option)
    })
    
    // Add event listener for change
    selector.addEventListener('change', function() {
        if (this.value) {
            showEmployeeDetails(this.value)
        } else {
            hideEmployeeDetails()
        }
    })
}

// Show detailed employee analytics
async function showEmployeeDetails(employeeEmail) {
    try {
        // Set the dropdown value
        document.getElementById('employee-select').value = employeeEmail;
        
        // Show the details container
        document.getElementById('employee-details').classList.remove('hidden');
        document.querySelector('#employee-detail-container > div:first-child').classList.add('hidden');
        
        // Check if we have cached metrics
        if (!window.employeeMetricsData) {
            // If metrics are not available, fetch them from the database
            await loadEmployeePerformance();
            
            // If still not available after loading, throw an error
            if (!window.employeeMetricsData) {
                throw new Error('Employee metrics data not available');
            }
        }
        
        // Get employee data from cached metrics
        const employeeData = window.employeeMetricsData.find(e => e.email === employeeEmail);
        if (!employeeData) {
            throw new Error('Employee data not found');
        }
        
        // Update basic metrics
        document.getElementById('emp-avg-response').textContent = 
            `${Math.round(employeeData.avgResponseTime)}m`;
        document.getElementById('emp-sla').textContent = 
            `${employeeData.slaRate}%`;
        document.getElementById('emp-completed').textContent = 
            employeeData.completedRequests;
        
        // Calculate completion percentage
        const completionPercent = employeeData.totalRequests > 0 
            ? ((employeeData.completedRequests / employeeData.totalRequests) * 100).toFixed(1) 
            : '0';
        document.getElementById('emp-completed-percent').textContent = `${completionPercent}%`;
        
        // Update progress bars
        document.getElementById('emp-response-bar').style.width = 
            `${Math.min((employeeData.avgResponseTime / 30) * 100, 100)}%`;
        document.getElementById('emp-sla-bar').style.width = 
            `${employeeData.slaRate}%`;
        
        // Get requests for this employee
        const { data: employeeRequests, error } = await supabaseClient
            .from('requests')
            .select('*')
            .eq('assigned_to', employeeData.assignee)
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        
        // Store the full requests list for pagination
        window.currentEmployeeRequests = employeeRequests;
        window.currentEmployeePage = 1;
        
        // Prepare data for daily chart
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 6); // Last 7 days including today
        
        const recentRequests = employeeRequests.filter(r => 
            new Date(r.created_at) >= last7Days
        );
        
        const dailyData = Array(7).fill(0);
        const statusData = { 'in-progress': 0, 'completed': 0, 'request-issue': 0, 'waiting-request': 0 };
        
        recentRequests.forEach(request => {
            const requestDate = new Date(request.created_at);
            const dayIndex = 6 - Math.floor((new Date() - requestDate) / (1000 * 60 * 60 * 24));
            if (dayIndex >= 0 && dayIndex < 7) {
                dailyData[dayIndex]++;
            }
            
            // Count statuses
            if (statusData.hasOwnProperty(request.status)) {
                statusData[request.status]++;
            }
        });
        
        // Create or update charts
        updateEmployeeCharts(dailyData, statusData);
        
        // Update recent activity table with pagination
        updateEmployeeActivity(employeeRequests, 1);
        
        // Add pagination controls if not already added
        if (!document.getElementById('activity-pagination')) {
            const paginationDiv = document.createElement('div');
            paginationDiv.id = 'activity-pagination';
            paginationDiv.className = 'flex justify-between items-center mt-4';
            paginationDiv.innerHTML = `
                <div class="text-sm text-gray-500">
                    Showing <span id="activity-page-info">1-30 of ${employeeRequests.length}</span> requests
                </div>
                <div class="flex items-center gap-2">
                    <button id="activity-prev-page" class="btn-sm btn-outline-secondary" disabled>
                        <i class="fas fa-chevron-left mr-1"></i> Previous
                    </button>
                    <span id="activity-current-page" class="px-3 py-1 bg-gray-100 rounded">1</span>
                    <button id="activity-next-page" class="btn-sm btn-outline-secondary" ${employeeRequests.length <= 30 ? 'disabled' : ''}>
                        Next <i class="fas fa-chevron-right ml-1"></i>
                    </button>
                </div>
            `;
            
            // Find the table parent container
            const activityTable = document.getElementById('employee-activity').closest('div');
            activityTable.after(paginationDiv);
            
            // Add event listeners for pagination
            document.getElementById('activity-prev-page').addEventListener('click', () => {
                if (window.currentEmployeePage > 1) {
                    window.currentEmployeePage--;
                    updateEmployeeActivity(window.currentEmployeeRequests, window.currentEmployeePage);
                }
            });
            
            document.getElementById('activity-next-page').addEventListener('click', () => {
                const maxPage = Math.ceil(window.currentEmployeeRequests.length / 30);
                if (window.currentEmployeePage < maxPage) {
                    window.currentEmployeePage++;
                    updateEmployeeActivity(window.currentEmployeeRequests, window.currentEmployeePage);
                }
            });
        } else {
            // Update pagination info
            document.getElementById('activity-page-info').textContent = 
                `1-${Math.min(30, employeeRequests.length)} of ${employeeRequests.length}`;
            document.getElementById('activity-current-page').textContent = '1';
            document.getElementById('activity-prev-page').disabled = true;
            document.getElementById('activity-next-page').disabled = employeeRequests.length <= 30;
        }
        
    } catch (error) {
        console.error('Error showing employee details:', error);
        showNotification('Error loading employee details. Try refreshing the page.', 'error');
    }
}

// Hide employee details
function hideEmployeeDetails() {
    document.getElementById('employee-details').classList.add('hidden')
    document.querySelector('#employee-detail-container > div:first-child').classList.remove('hidden')
}

// Update employee charts
function updateEmployeeCharts(dailyData, statusData) {
    // Prepare labels for last 7 days
    const dayLabels = []
    const currentDate = new Date()
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(currentDate.getDate() - i)
        dayLabels.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    
    // Daily chart
    if (employeeDailyChart) {
        employeeDailyChart.data.labels = dayLabels
        employeeDailyChart.data.datasets[0].data = dailyData
        employeeDailyChart.update()
    } else {
        const ctx = document.getElementById('employee-daily-chart').getContext('2d')
        employeeDailyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dayLabels,
                datasets: [{
                    label: 'Requests',
                    data: dailyData,
                    backgroundColor: '#3B82F6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        })
    }
    
    // Status chart
    if (employeeStatusChart) {
        employeeStatusChart.data.datasets[0].data = [
            statusData['in-progress'] || 0,
            statusData['completed'] || 0,
            statusData['request-issue'] || 0,
            statusData['waiting-request'] || 0
        ]
        employeeStatusChart.update()
    } else {
        const ctx = document.getElementById('employee-status-chart').getContext('2d')
        employeeStatusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['In Progress', 'Completed', 'Request Issue', 'Waiting Request'],
                datasets: [{
                    data: [
                        statusData['in-progress'] || 0,
                        statusData['completed'] || 0,
                        statusData['request-issue'] || 0,
                        statusData['waiting-request'] || 0
                    ],
                    backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        })
    }
}

// Update employee activity table
function updateEmployeeActivity(requests, page = 1) {
    const activityContainer = document.getElementById('employee-activity')
    
    if (!requests || requests.length === 0) {
        activityContainer.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-6 text-center text-gray-500">
                    No recent activity
                </td>
            </tr>
        `
        return
    }
    
    // Calculate pagination
    const itemsPerPage = 30
    const totalPages = Math.ceil(requests.length / itemsPerPage)
    const startIndex = (page - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, requests.length)
    
    // Update pagination controls if they exist
    if (document.getElementById('activity-pagination')) {
        document.getElementById('activity-page-info').textContent = 
            `${startIndex + 1}-${endIndex} of ${requests.length}`
        document.getElementById('activity-current-page').textContent = page
        document.getElementById('activity-prev-page').disabled = page <= 1
        document.getElementById('activity-next-page').disabled = page >= totalPages
    }
    
    // Get the paginated requests
    const paginatedRequests = requests.slice(startIndex, endIndex)
    
    activityContainer.innerHTML = paginatedRequests.map(request => {
        // Calculate response time if available
        let responseTime = 'N/A'
        if (request.first_response_time) {
            // Use assigned_at if available, otherwise fall back to created_at
            const startTime = request.assigned_at 
                ? new Date(request.assigned_at) 
                : new Date(request.created_at)
            const responded = new Date(request.first_response_time)
            const diffMinutes = Math.round((responded - startTime) / 60000)
            
            let responseClass = 'text-green-600'
            if (diffMinutes > SLA_THRESHOLD_MINUTES) {
                responseClass = 'text-red-600'
            }
            
            responseTime = `<span class="${responseClass}">${diffMinutes}m</span>`
        }
        
        return `
            <tr class="cursor-pointer hover:bg-gray-50" data-request-id="${request.id}" onclick="viewRequestNotes('${request.id}')">
                <td class="px-4 py-3">${new Date(request.updated_at || request.created_at).toLocaleString()}</td>
                <td class="px-4 py-3">${request.customer_name}</td>
                <td class="px-4 py-3">
                    <span class="status-pill status-${request.status}">
                        ${formatStatus(request.status)}
                    </span>
                </td>
                <td class="px-4 py-3">${responseTime}</td>
            </tr>
        `
    }).join('')
}

// View request notes in a modal
async function viewRequestNotes(requestId) {
    try {
        // Get request details including notes
        const { data: request, error } = await supabaseClient
            .from('requests')
            .select('*')
            .eq('id', requestId)
            .single()
            
        if (error) throw error
            
        // Create modal if it doesn't exist
        let modal = document.getElementById('request-notes-modal')
        if (!modal) {
            modal = document.createElement('div')
            modal.id = 'request-notes-modal'
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
            document.body.appendChild(modal)
        }
        
        // Format dates
        const created = new Date(request.created_at).toLocaleString()
        const updated = new Date(request.updated_at).toLocaleString()
        
        // Set modal content
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 animate-fade-in">
                <div class="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                    <h3 class="text-lg font-semibold text-gray-800">
                        Request Details - ${request.customer_name}
                    </h3>
                    <button class="text-gray-400 hover:text-gray-600" onclick="closeRequestNotesModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="p-6 max-h-[70vh] overflow-y-auto">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="bg-gray-50 p-3 rounded">
                            <span class="text-sm font-medium text-gray-500">Phone Number</span>
                            <p>${request.phone_number}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded">
                            <span class="text-sm font-medium text-gray-500">Status</span>
                            <p><span class="status-pill status-${request.status}">
                                ${formatStatus(request.status)}
                            </span></p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded">
                            <span class="text-sm font-medium text-gray-500">Created</span>
                            <p>${created}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded">
                            <span class="text-sm font-medium text-gray-500">Last Updated</span>
                            <p>${updated}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-4">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-700 mb-2">
                                <i class="fas fa-comment-dots mr-2"></i>Sales Notes
                            </h4>
                            <p class="whitespace-pre-line text-gray-800">${request.notes || 'No sales notes available'}</p>
                        </div>
                        
                        <div class="bg-purple-50 p-4 rounded-lg">
                            <h4 class="font-medium text-purple-700 mb-2">
                                <i class="fas fa-headset mr-2"></i>Non-Voice Notes
                            </h4>
                            <p class="whitespace-pre-line text-gray-800">${request.non_voice_notes || 'No non-voice notes available'}</p>
                        </div>
                    </div>
                </div>
                <div class="border-t border-gray-200 px-6 py-4 flex justify-end">
                    <button class="btn btn-secondary" onclick="closeRequestNotesModal()">
                        Close
                    </button>
                </div>
            </div>
        `
        
        // Show the modal
        modal.style.display = 'flex'
        
    } catch (error) {
        console.error('Error loading request notes:', error)
        showNotification('Error loading request details', 'error')
    }
}

// Close request notes modal
function closeRequestNotesModal() {
    const modal = document.getElementById('request-notes-modal')
    if (modal) {
        modal.style.display = 'none'
    }
}

// Setup real-time subscriptions
function setupRealTimeSubscriptions() {
    // Subscribe to request changes
    supabaseClient
        .channel('requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, payload => {
            loadTodayStats()
        })
        .subscribe()

    // Subscribe to employee status changes
    supabaseClient
        .channel('employees')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests_users' }, payload => {
            loadEmployeePerformance()
        })
        .subscribe()
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container')
    const notification = document.createElement('div')
    notification.className = `notification animate-fade-in ${type}`
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle text-red-500' : 'info-circle text-blue-500'} mr-2"></i>
            <p class="text-gray-800">${message}</p>
        </div>
    `
    container.appendChild(notification)
    setTimeout(() => {
        notification.remove()
    }, 5000)
}

// Format request status
function formatStatus(status) {
    switch (status) {
        case 'in-progress': return 'In Progress'
        case 'completed': return 'Completed'
        case 'request-issue': return 'Request Issue'
        case 'waiting-request': return 'Waiting Request'
        case 'open': return 'Open'
        default: return status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        showLoading();
        
        // Check user session
        const { data: { user }, error: sessionError } = await supabaseClient.auth.getUser();
        
        if (sessionError || !user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Set SLA threshold from config
        window.SLA_THRESHOLD_MINUTES = 15; // 15 minutes threshold
        
        // Fetch user information
        const { data: userData, error: userError } = await supabaseClient
            .from('requests_users')
            .select('*')
            .eq('email', user.email)
            .single();
            
        if (userError) {
            showNotification('Error loading user information', 'error');
            console.error(userError);
        } else if (userData) {
            // Fix: Use the assignee field instead of name
            document.getElementById('user-name').textContent = userData.assignee || user.email;
            window.currentUser = userData;
        }
        
        // Add date filter UI
        addDateFilterUI();
        
        // Initialize charts and gauges
        initializeCharts();
        
        // Remove the bottom gauges section
        replaceGaugesSection();
        
        // Load all dashboard data
        await Promise.all([
            loadTodayStats(),
            loadEmployeePerformance(),
            loadOverdueRequests(),
            loadApproachingOverdueRequests() // Add this new function
        ]);
        
        // Setup event listeners
        setupEventListeners();
        
        // Set up real-time subscriptions
        setupRealTimeSubscriptions();
        
        // Initialize auto-refresh
        setupAutoRefresh();
        
        hideLoading();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error loading dashboard', 'error');
        hideLoading();
    }
}

// Replace the gauges section with more useful metrics
function replaceGaugesSection() {
    // Target the bottom SLA Monitoring section specifically
    const gaugesSection = document.querySelector('main > div.bg-white.rounded-lg.shadow-sm.p-6.animate-fade-in:last-child');
    
    if (gaugesSection && gaugesSection.querySelector('h3')?.textContent.includes('SLA Monitoring')) {
        // Remove this section entirely
        gaugesSection.remove();
    }
}

// Get labels for the last 7 days
function getLast7DaysLabels() {
    const labels = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }
    return labels;
}

// Setup auto-refresh for dashboard data
function setupAutoRefresh() {
    // Refresh all data every 30 seconds
    setInterval(() => {
        refreshDashboardData();
    }, 30000);
    
    // Refresh just the SLA tables more frequently (every 10 seconds)
    setInterval(() => {
        console.log("Auto-refreshing SLA tables...");
        Promise.all([
            loadOverdueRequests(),
            loadApproachingOverdueRequests()
        ]).catch(error => {
            console.error("Error in SLA auto-refresh:", error);
        });
    }, 10000);
}

// Refresh all dashboard data with animations
async function refreshDashboardData() {
    try {
        // Update today's stats with animation
        await animatedDataUpdate(loadTodayStats);
        
        // Update employee performance with animation
        await animatedDataUpdate(loadEmployeePerformance);
        
        // Update overdue requests with animation
        await animatedDataUpdate(loadOverdueRequests);
        
        // Update approaching overdue requests
        await animatedDataUpdate(loadApproachingOverdueRequests);
        
        // Update charts data
        updateChartsData();
        
        // Update currently selected employee details if any
        const selectedEmployee = document.getElementById('employee-select').value;
        if (selectedEmployee) {
            await animatedDataUpdate(() => showEmployeeDetails(selectedEmployee));
        }
        
        console.log('Dashboard data refreshed');
    } catch (error) {
        console.error('Error refreshing dashboard data:', error);
    }
}

// Wrap data loading functions with animations
async function animatedDataUpdate(loadFunction) {
    try {
        // Execute the loading function
        await loadFunction();
    } catch (error) {
        console.error('Error in animated data update:', error);
        throw error;
    }
}

// Update charts data with animation
async function updateChartsData() {
    try {
        // Get active date filter
        const dateFilter = getActiveDateFilter();
        
        // Get requests for the selected period
        const { data: requests, error } = await supabaseClient
            .from('requests')
            .select('*')
            .gte('created_at', dateFilter.startDate.toISOString())
            .lt('created_at', dateFilter.endDate.toISOString());
            
        if (error) throw error;
        
        // Update status distribution chart
        updateStatusDistributionChart(requests);
        
        // For hourly chart, determine if we're looking at a single day or multiple days
        if (dateFilter.startDate.toDateString() === dateFilter.endDate.toDateString() ||
            (dateFilter.endDate - dateFilter.startDate) <= 86400000) { // Within a day
            // Use hourly chart for a single day
            updateHourlyVolumeChart(requests);
        } else {
            // For multi-day periods, convert to a daily chart
            updateDailyVolumeChart(requests, dateFilter);
        }
        
    } catch (error) {
        console.error('Error updating charts data:', error);
    }
}

// Update status distribution chart with animation
function updateStatusDistributionChart(requests) {
    if (!window.statusDistChart) return;
    
    // Get current values from chart
    const currentData = window.statusDistChart.data.datasets[0].data;
    
    // Calculate new counts
    const statusCounts = {
        'open': 0,
        'in-progress': 0,
        'completed': 0,
        'waiting-request': 0,
        'request-issue': 0
    };
    
    requests.forEach(request => {
        if (statusCounts.hasOwnProperty(request.status)) {
            statusCounts[request.status]++;
        }
    });
    
    // Group completed, waiting-request, and request-issue into "Done" category
    const open = statusCounts['open'];
    const inProgress = statusCounts['in-progress'];
    const done = statusCounts['completed'] + statusCounts['waiting-request'] + statusCounts['request-issue'];
    
    // New data array
    const newData = [open, inProgress, done];
    
    // Animate from current to new values
    animateChartDataTransition(window.statusDistChart, currentData, newData);
}

// Update hourly volume chart with animation
function updateHourlyVolumeChart(requests) {
    if (!window.hourlyVolumeChart) return;
    
    // Get current values from chart
    const currentData = [...window.hourlyVolumeChart.data.datasets[0].data];
    
    // Create new data array with hourly counts
    const hourlyData = Array(24).fill(0);
    
    requests.forEach(request => {
        const date = new Date(request.created_at);
        const hour = date.getHours();
        hourlyData[hour]++;
    });
    
    // Update chart title to reflect hourly view
    window.hourlyVolumeChart.options.plugins.title = {
        display: true,
        text: 'Hourly Request Volume',
        font: {
            size: 16,
            weight: 'bold'
        }
    };
    
    // Update x-axis label
    window.hourlyVolumeChart.data.labels = Array.from({length: 24}, (_, i) => `${i}:00`);
    
    // Animate from current to new values
    animateChartDataTransition(window.hourlyVolumeChart, currentData, hourlyData);
}

// New function to update daily volume chart for multi-day periods
function updateDailyVolumeChart(requests, dateFilter) {
    if (!window.hourlyVolumeChart) return;
    
    // Calculate number of days in the range
    const dayDiff = Math.ceil((dateFilter.endDate - dateFilter.startDate) / (1000 * 60 * 60 * 24));
    
    // Create an array of dates in the range
    const dates = [];
    const dayData = [];
    
    // Initialize date array and zero-fill data
    for (let i = 0; i < dayDiff; i++) {
        const date = new Date(dateFilter.startDate);
        date.setDate(date.getDate() + i);
        
        // Format date as string for display
        dates.push(date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        }));
        
        // Initialize with zero
        dayData.push(0);
    }
    
    // Count requests by day
    requests.forEach(request => {
        const requestDate = new Date(request.created_at);
        const dayIndex = Math.floor((requestDate - dateFilter.startDate) / (1000 * 60 * 60 * 24));
        
        if (dayIndex >= 0 && dayIndex < dayDiff) {
            dayData[dayIndex]++;
        }
    });
    
    // Update chart title to reflect daily view
    window.hourlyVolumeChart.options.plugins.title = {
        display: true,
        text: 'Daily Request Volume',
        font: {
            size: 16,
            weight: 'bold'
        }
    };
    
    // Update labels and animate data change
    window.hourlyVolumeChart.data.labels = dates;
    animateChartDataTransition(window.hourlyVolumeChart, window.hourlyVolumeChart.data.datasets[0].data, dayData);
}

// Setup event listeners
function setupEventListeners() {
    // Logout button
    document.getElementById('logout')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });
    
    // Refresh SLA monitoring button
    document.getElementById('refresh-sla')?.addEventListener('click', async () => {
        try {
            const button = document.getElementById('refresh-sla');
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-1"></i> Refreshing...';
            
            // Load both overdue and approaching items
            await Promise.all([
                loadOverdueRequests(),
                loadApproachingOverdueRequests()
            ]);
            
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Refresh';
            
            showNotification('SLA monitoring refreshed', 'success');
        } catch (error) {
            console.error('Error refreshing SLA monitoring:', error);
            showNotification('Error refreshing data', 'error');
        }
    });
    
    // Time period selector for employee performance
    document.getElementById('time-period')?.addEventListener('change', async () => {
        try {
            await loadEmployeePerformance();
        } catch (error) {
            console.error('Error updating employee performance:', error);
            showNotification('Error updating employee data', 'error');
        }
    });
    
    // Refresh employee performance button
    document.getElementById('refresh-performance')?.addEventListener('click', async () => {
        try {
            const button = document.getElementById('refresh-performance');
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-1"></i> Refreshing...';
            
            await loadEmployeePerformance();
            
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Refresh';
            
            showNotification('Employee performance refreshed', 'success');
        } catch (error) {
            console.error('Error refreshing employee performance:', error);
            showNotification('Error refreshing data', 'error');
        }
    });
    
    // Employee selector
    document.getElementById('employee-select')?.addEventListener('change', async (e) => {
        const selectedValue = e.target.value;
        
        if (selectedValue) {
            await showEmployeeDetails(selectedValue);
        } else {
            hideEmployeeDetails();
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeDashboard)

document.getElementById('logout').addEventListener('click', async () => {
    try {
        const { error } = await supabaseClient.auth.signOut()
        if (error) throw error
        window.location.href = 'login.html'
    } catch (error) {
        console.error('Error signing out:', error)
        showNotification('Error signing out', 'error')
    }
})

// Send reminder to employee about overdue request
async function sendReminder(requestId, assignedTo) {
    try {
        console.log('Sending reminder for request:', requestId, 'to:', assignedTo);
        
        // Find the row by request ID
        const row = document.querySelector(`tr[data-request-id="${requestId}"]`);
        if (!row) {
            console.error('Could not find row for request:', requestId);
            throw new Error('Could not find request row');
        }

        // Get customer details from the database
        const { data: request, error: requestError } = await supabaseClient
            .from('requests')
            .select('customer_name, phone_number')
            .eq('id', requestId)
            .single();

        if (requestError) {
            console.error('Error fetching request details:', requestError);
            throw requestError;
        }

        // Update button state if it exists
        const reminderButton = row.querySelector('button[data-request-id="${requestId}"]');
        if (reminderButton) {
            reminderButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            reminderButton.disabled = true;
        }

        // Get employee's email from requests_users table using their name
        const { data: employee, error: employeeError } = await supabaseClient
            .from('requests_users')
            .select('email')
            .eq('assignee', assignedTo)
            .single();

        if (employeeError) {
            console.error('Error getting employee email:', employeeError);
            showNotification('Failed to send reminder: Could not find employee', 'error');
            return;
        }

        console.log('Found employee email:', employee.email);

        // Create real-time notification using Supabase's real-time broadcast
        const channelName = `private-${employee.email.replace('@', '-')}`;
        console.log('Using channel:', channelName);

        const { error: broadcastError } = await supabaseClient
            .channel(channelName)
            .send({
                type: 'broadcast',
                event: 'sla_reminder',
                payload: {
                    customerName: request.customer_name,
                    phoneNumber: request.phone_number,
                    assignedTo: assignedTo,
                    timestamp: new Date().toISOString()
                }
            });

        if (broadcastError) {
            console.error('Error sending broadcast:', broadcastError);
            throw broadcastError;
        }

        console.log('Broadcast sent successfully');

        // Show success notification to admin
        showNotification('Reminder sent successfully!', 'success');

        // Reset button state if it exists
        if (reminderButton) {
            reminderButton.innerHTML = '<i class="fas fa-bell"></i> Remind';
            reminderButton.disabled = false;
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        showNotification('Failed to send reminder: ' + error.message, 'error');
        
        // Reset button state if it exists
        const errorRow = document.querySelector(`tr[data-request-id="${requestId}"]`);
        if (errorRow) {
            const errorButton = errorRow.querySelector('button[data-request-id="${requestId}"]');
            if (errorButton) {
                errorButton.innerHTML = '<i class="fas fa-bell"></i> Remind';
                errorButton.disabled = false;
            }
        }
    }
}

// Show loading overlay
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
        document.body.classList.add('loading');
    }
}

// Hide loading overlay
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
        document.body.classList.remove('loading');
    }
}

// Animate chart data transitions
function animateChartDataTransition(chart, currentData, newData) {
    // Create a copy of the current data to avoid reference issues
    const startData = [...currentData];
    
    // Start time and animation duration
    const startTime = performance.now();
    const duration = 800; // milliseconds
    
    // Animation function
    const animateFrame = (timestamp) => {
        // Calculate progress (0 to 1)
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Interpolate between start and end values
        const currentValues = startData.map((startValue, index) => {
            const endValue = newData[index] || 0;
            return startValue + ((endValue - startValue) * progress);
        });
        
        // Update chart with current interpolated values
        chart.data.datasets[0].data = currentValues;
        chart.update('none'); // Update without animation for smoother custom animation
        
        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animateFrame);
        } else {
            // Ensure final values are exactly as specified
            chart.data.datasets[0].data = newData;
            chart.update('none');
        }
    };
    
    // Start animation
    requestAnimationFrame(animateFrame);
}

// Load overdue requests
async function loadOverdueRequests() {
    try {
        // Get current timestamp
        const now = new Date();
        
        // Get active time period (for filtering)
        const dateFilter = getActiveDateFilter();

        console.log("Loading overdue requests...");
        console.log("Current time:", now);
        console.log("Date filter:", dateFilter);
        
        // Get requests that haven't been responded to within SLA
        const { data: openRequests, error } = await supabaseClient
            .from('requests')
            .select('*')
            .or('status.eq.open,status.eq.in-progress')
            .is('first_response_time', null)
            .gte('created_at', dateFilter.startDate.toISOString())
            .lte('created_at', dateFilter.endDate.toISOString())
            .order('created_at', { ascending: true });
            
        if (error) {
            console.error("Error fetching requests:", error);
            throw error;
        }
        
        console.log("Fetched requests:", openRequests ? openRequests.length : 0);
        
        // Filter requests that are overdue based on SLA threshold
        const overdueRequests = openRequests.filter(request => {
            // Calculate how long the request has been waiting
            // Use assigned_at if available, otherwise use created_at
            const startTime = request.assigned_at ? new Date(request.assigned_at) : new Date(request.created_at);
            const waitingTimeMinutes = (now - startTime) / 60000;
            
            console.log(`Request ${request.id}, created: ${new Date(request.created_at).toISOString()}, assigned: ${request.assigned_at ? new Date(request.assigned_at).toISOString() : 'N/A'}`);
            console.log(`Request ${request.id}, time: ${waitingTimeMinutes.toFixed(2)}min, threshold: ${SLA_THRESHOLD_MINUTES}min`);
            
            // If waiting time exceeds SLA threshold, it's overdue
            return waitingTimeMinutes > SLA_THRESHOLD_MINUTES;
        });
        
        console.log("Filtered overdue requests:", overdueRequests.length);
        
        // Sort by time elapsed (most overdue first)
        overdueRequests.sort((a, b) => {
            const startTimeA = a.assigned_at ? new Date(a.assigned_at) : new Date(a.created_at);
            const startTimeB = b.assigned_at ? new Date(b.assigned_at) : new Date(b.created_at);
            const diffA = now - startTimeA;
            const diffB = now - startTimeB;
            return diffB - diffA; // Reverse order - most overdue first
        });
        
        // Store all overdue items globally for pagination
        window.allOverdueItems = overdueRequests;
        window.currentOverduePage = 1;
        
        // Update the overdue count display
        const overdueCountElement = document.getElementById('overdue-count');
        if (overdueCountElement) {
            const count = overdueRequests.length;
            overdueCountElement.textContent = `${count} overdue`;
            
            // Add/remove pulse animation based on whether there are overdues
            if (count > 0) {
                overdueCountElement.classList.add('animate-pulse');
                overdueCountElement.style.backgroundColor = '#FEE2E2';
                overdueCountElement.style.color = '#991B1B';
            } else {
                overdueCountElement.classList.remove('animate-pulse');
                overdueCountElement.style.backgroundColor = '#ECFDF5';
                overdueCountElement.style.color = '#065F46';
            }
        }
        
        // Render the first page of overdue requests
        await renderOverduePage(1);
        
    } catch (error) {
        console.error('Error loading overdue requests:', error);
        showNotification('Error loading overdue requests', 'error');
    }
}

// Render a specific page of overdue requests
async function renderOverduePage(page) {
    const itemsPerPage = ITEMS_PER_PAGE || 10;
    const overdueItems = window.allOverdueItems || [];
    const totalPages = Math.ceil(overdueItems.length / itemsPerPage);
    
    console.log("Rendering overdue page:", page);
    console.log("Total overdue items:", overdueItems.length);
    console.log("Total pages:", totalPages);
    
    // Ensure page is within bounds
    page = Math.max(1, Math.min(page, totalPages || 1));
    window.currentOverduePage = page;
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, overdueItems.length);
    const pageItems = overdueItems.slice(startIndex, endIndex);
    
    console.log("Page items:", pageItems.length);
    
    const tableBody = document.getElementById('overdue-requests');
    if (!tableBody) {
        console.error("Overdue requests table body not found");
        return; // Safety check
    }
    
    // Get existing rows for comparison
    const existingRows = Array.from(tableBody.querySelectorAll('tr:not(.empty-state-row)'));
    const existingEmptyState = tableBody.querySelector('.empty-state-row');
    
    // If we have overdue items and empty state is showing, fade it out and remove
    if (pageItems.length > 0 && existingEmptyState) {
        existingEmptyState.style.transition = 'opacity 300ms';
        existingEmptyState.style.opacity = '0';
        
        // After fade out completes, remove it
        await new Promise(resolve => setTimeout(() => {
            existingEmptyState.remove();
            resolve();
        }, 300));
    }
    
    // If no overdue items, show empty state (if not already showing)
    if (overdueItems.length === 0) {
        if (!existingEmptyState) {
            // Clear existing rows with fade-out
            for (const row of existingRows) {
                row.style.transition = 'opacity 300ms';
                row.style.opacity = '0';
            }
            
            // After fade-out completes, remove rows
            await new Promise(resolve => setTimeout(() => {
                for (const row of existingRows) {
                    row.remove();
                }
                resolve();
            }, 300));
            
            // Add empty state
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'empty-state-row';
            emptyRow.innerHTML = `
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
                    <p>No overdue requests at the moment</p>
                </td>
            `;
            emptyRow.style.opacity = '0';
            tableBody.appendChild(emptyRow);
            
            // Fade in empty state
            setTimeout(() => {
                emptyRow.style.transition = 'opacity 300ms';
                emptyRow.style.opacity = '1';
            }, 10);
        }
        
        // Hide pagination
        const paginationElement = document.getElementById('overdue-pagination');
        if (paginationElement) paginationElement.classList.add('hidden');
        return;
    }
    
    // Show pagination controls and update info
    setupOverduePagination(page, totalPages);
    
    // Get IDs of existing rows and current page items
    const existingIds = existingRows.map(row => row.getAttribute('data-request-id'));
    const currentIds = pageItems.map(request => request.id.toString());
    
    // Calculate which rows to add, remove, or update
    const rowsToRemove = existingRows.filter(row => !currentIds.includes(row.getAttribute('data-request-id')));
    const rowsToAdd = pageItems.filter(request => !existingIds.includes(request.id.toString()));
    const rowsToUpdate = pageItems.filter(request => existingIds.includes(request.id.toString()));
    
    // Handle rows to remove
    if (rowsToRemove.length > 0) {
        // Fade out rows to remove
        for (const row of rowsToRemove) {
            row.style.transition = 'opacity 300ms, transform 300ms';
            row.style.opacity = '0';
            row.style.transform = 'translateY(-10px)';
        }
        
        // After animation completes, remove them
        await new Promise(resolve => setTimeout(() => {
            for (const row of rowsToRemove) {
                row.remove();
            }
            resolve();
        }, 300));
    }
    
    // Update existing rows
    const now = new Date();
    for (const request of rowsToUpdate) {
        const row = existingRows.find(r => r.getAttribute('data-request-id') === request.id.toString());
        if (row) {
            const startTime = request.assigned_at ? new Date(request.assigned_at) : new Date(request.created_at);
            const diffMinutes = Math.floor((now - startTime) / 60000);
            const diffHours = Math.floor(diffMinutes / 60);
            
            // Update elapsed time with highlighted animation
            const elapsedTimeCell = row.querySelector('.elapsed-time');
            if (elapsedTimeCell) {
                const newTimeText = diffHours > 0 ? `${diffHours}h ${diffMinutes % 60}m` : `${diffMinutes}m`;
                
                if (elapsedTimeCell.textContent.trim() !== newTimeText) {
                    // Highlight the changed time
                    elapsedTimeCell.style.transition = 'background-color 1.5s';
                    elapsedTimeCell.style.backgroundColor = 'rgba(254, 226, 226, 0.5)'; // Light red highlight
                    elapsedTimeCell.textContent = newTimeText;
                    
                    // Reset background after animation
                    setTimeout(() => {
                        elapsedTimeCell.style.backgroundColor = 'transparent';
                    }, 1500);
                    
                    // Update class if time exceeds thresholds
                    if (diffMinutes > SLA_THRESHOLD_MINUTES * 2) {
                        elapsedTimeCell.className = 'elapsed-time font-mono text-red-600 font-bold';
                    } else {
                        elapsedTimeCell.className = 'elapsed-time font-mono text-amber-600';
                    }
                }
            }
            
            // Update status if needed
            const statusCell = row.querySelector('.status-pill');
            if (statusCell && !statusCell.classList.contains(`status-${request.status}`)) {
                const oldClasses = Array.from(statusCell.classList)
                    .filter(cls => cls.startsWith('status-') && cls !== 'status-pill');
                
                for (const cls of oldClasses) {
                    statusCell.classList.remove(cls);
                }
                
                statusCell.classList.add(`status-${request.status}`);
                statusCell.innerHTML = `
                    <i class="fas fa-${getStatusIcon(request.status)}"></i>
                    ${formatStatus(request.status)}
                `;
                
                // Highlight the changed status
                statusCell.style.transition = 'transform 0.3s, box-shadow 0.3s';
                statusCell.style.transform = 'scale(1.05)';
                statusCell.style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)';
                
                setTimeout(() => {
                    statusCell.style.transform = 'scale(1)';
                    statusCell.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                }, 1000);
            }
            
            // Update assigned to if needed
            const assignedToCell = row.querySelector('.assigned-to');
            if (assignedToCell) {
                const newAssignedText = request.assigned_to || 'Unassigned';
                if (assignedToCell.textContent.trim() !== newAssignedText) {
                    assignedToCell.textContent = newAssignedText;
                    assignedToCell.className = `assigned-to font-medium ${request.assigned_to ? '' : 'text-red-500'}`;
                    
                    // Highlight the changed assignment
                    assignedToCell.style.transition = 'background-color 1.5s';
                    assignedToCell.style.backgroundColor = 'rgba(219, 234, 254, 0.5)'; // Light blue highlight
                    
                    setTimeout(() => {
                        assignedToCell.style.backgroundColor = 'transparent';
                    }, 1500);
                }
            }
            
            // Update remind button if needed
            const reminderButton = row.querySelector('.btn-sm');
            if (reminderButton) {
                // Update button onclick attribute with just the request ID and assigned_to
                reminderButton.setAttribute('onclick', `sendReminder('${request.id}', '${request.assigned_to || 'Unassigned'}')`);
            }
        }
    }
    
    // Add new rows
    for (let i = 0; i < rowsToAdd.length; i++) {
        const request = rowsToAdd[i];
        const newRow = document.createElement('tr');
        const now = new Date();
        const startTime = request.assigned_at ? new Date(request.assigned_at) : new Date(request.created_at);
        const diffMinutes = Math.floor((now - startTime) / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        
        // Format employee_email for the remind button if it exists in the request
        let employeeEmailParam = '';
        if (request.assigned_to && window.employeeMetricsData) {
            const employeeData = window.employeeMetricsData.find(e => e.assignee === request.assigned_to);
            if (employeeData && employeeData.email) {
                employeeEmailParam = `'${employeeData.email}'`;
            }
        }
        
        newRow.className = 'transition-all duration-300 hover:bg-gray-50';
        newRow.setAttribute('data-request-id', request.id);
        
        // Add data to row
        newRow.innerHTML = `
            <td class="px-4 py-3">
                <span class="text-xs font-semibold">#${request.id}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex flex-col">
                    <span class="font-medium">${request.customer_name}</span>
                    <span class="text-xs text-gray-500">${request.phone_number || ''}</span>
                </div>
            </td>
            <td class="px-4 py-3">
                <span class="assigned-to font-medium ${request.assigned_to ? '' : 'text-red-500'}">
                    ${request.assigned_to || 'Unassigned'}
                </span>
            </td>
            <td class="px-4 py-3">
                <span class="status-pill status-${request.status}">
                    <i class="fas fa-${getStatusIcon(request.status)}"></i>
                    ${formatStatus(request.status)}
                </span>
            </td>
            <td class="px-4 py-3">
                <span class="elapsed-time font-mono ${diffMinutes > SLA_THRESHOLD_MINUTES * 2 ? 'text-red-600 font-bold' : 'text-amber-600'}">
                    ${diffHours > 0 ? `${diffHours}h ` : ''}${diffMinutes % 60}m
                </span>
            </td>
            <td class="px-4 py-3">
                <button 
                    class="btn-sm bg-red-50 text-red-600 hover:bg-red-100 rounded px-3 py-1 transition-colors duration-200"
                    onclick="sendReminder('${request.id}', '${request.assigned_to || 'Unassigned'}', ${employeeEmailParam})"
                >
                    <i class="fas fa-bell mr-1"></i> Remind
                </button>
            </td>
        `;
        
        // Set initial state for animation
        newRow.style.opacity = '0';
        newRow.style.transform = 'translateY(10px)';
        
        // Add to table
        tableBody.appendChild(newRow);
        
        // Trigger animation with staggered timing
        setTimeout(() => {
            newRow.style.transition = 'opacity 300ms, transform 300ms';
            newRow.style.opacity = '1';
            newRow.style.transform = 'translateY(0)';
        }, 50 * i); // Stagger by 50ms per row
    }
}

// Global variables for approaching overdue items
let approachingOverdueItems = [];
let currentApproachingPage = 1;
const APPROACHING_THRESHOLD_MIN = 12;
const APPROACHING_THRESHOLD_MAX = 14;
const ITEMS_PER_PAGE = 10;

// Load approaching overdue requests (requests between 12-14 minutes)
async function loadApproachingOverdueRequests() {
    try {
        // Get current timestamp
        const now = new Date();
        
        // Make sure threshold values are properly defined
        console.log("SLA_THRESHOLD_MINUTES:", SLA_THRESHOLD_MINUTES || 15);
        console.log("APPROACHING_THRESHOLD_MIN:", APPROACHING_THRESHOLD_MIN || 12);
        
        // Use default values if not defined
        const slaThreshold = SLA_THRESHOLD_MINUTES || 15;
        const approachingMin = APPROACHING_THRESHOLD_MIN || 12;
        
        // Get active time period (for filtering)
        const dateFilter = getActiveDateFilter();
        
        console.log("Loading approaching overdue requests...");
        console.log("Current time:", now);
        console.log("Date filter:", dateFilter);
        
        // Get all open/in-progress requests that haven't been responded to
        const { data: openRequests, error } = await supabaseClient
            .from('requests')
            .select('*')
            .or('status.eq.open,status.eq.in-progress')
            .is('first_response_time', null)
            .gte('created_at', dateFilter.startDate.toISOString())
            .lte('created_at', dateFilter.endDate.toISOString())
            .order('created_at', { ascending: true });
            
        if (error) {
            console.error("Error fetching requests for approaching overdue:", error);
            throw error;
        }
        
        console.log(`Found ${openRequests ? openRequests.length : 0} total open/in-progress requests`);
        
        // Filter requests that are approaching overdue based on threshold
        const approachingRequests = openRequests.filter(request => {
            // Calculate how long the request has been waiting
            const startTime = request.assigned_at ? new Date(request.assigned_at) : new Date(request.created_at);
            console.log(`  Using ${request.assigned_at ? 'assigned_at' : 'created_at'} time: ${startTime.toISOString()}`);
            const waitingTimeMinutes = (now - startTime) / 60000;
            
            console.log(`Approaching check - Request ${request.id}, created: ${new Date(request.created_at).toISOString()}, assigned: ${request.assigned_at ? new Date(request.assigned_at).toISOString() : 'N/A'}`);
            console.log(`Approaching check - Request ${request.id}, time: ${waitingTimeMinutes.toFixed(2)}min, threshold range: ${approachingMin}-${slaThreshold}min`);
            
            // Check if it's within the approaching threshold but not yet overdue
            const isApproaching = waitingTimeMinutes >= approachingMin && 
                                waitingTimeMinutes < slaThreshold;
                                
            console.log(`Approaching check - Request ${request.id}: ${isApproaching ? 'IS approaching' : 'NOT approaching'}`);
            
            return isApproaching;
        });
        
        console.log(`Filtered ${approachingRequests.length} approaching requests`);
        
        // Sort by time elapsed (closest to threshold first)
        approachingRequests.sort((a, b) => {
            const startTimeA = a.assigned_at ? new Date(a.assigned_at) : new Date(a.created_at);
            const startTimeB = b.assigned_at ? new Date(b.assigned_at) : new Date(b.created_at);
            const diffA = now - startTimeA;
            const diffB = now - startTimeB;
            return diffB - diffA; // Reverse order - closest to threshold first
        });
        
        // Store all approaching items globally for pagination
        approachingOverdueItems = approachingRequests;
        currentApproachingPage = 1;
        
        // Update the approaching count display
        const approachingCountElement = document.getElementById('approaching-count');
        if (approachingCountElement) {
            const count = approachingRequests.length;
            approachingCountElement.textContent = `${count} approaching`;
            
            // Add/remove pulse animation based on whether there are approaching items
            if (count > 0) {
                approachingCountElement.classList.add('animate-pulse');
                approachingCountElement.style.backgroundColor = '#FEF3C7';
                approachingCountElement.style.color = '#92400E';
            } else {
                approachingCountElement.classList.remove('animate-pulse');
                approachingCountElement.style.backgroundColor = '#ECFDF5';
                approachingCountElement.style.color = '#065F46';
            }
        }
        
        // Set threshold display
        const thresholdElement = document.getElementById('approaching-threshold');
        if (thresholdElement) {
            thresholdElement.textContent = `${approachingMin}-${slaThreshold-1}`;
        }
        
        // Render the first page of approaching overdue requests
        await renderApproachingPage(1);
        
    } catch (error) {
        console.error('Error loading approaching overdue requests:', error);
        showNotification('Error loading approaching overdue requests', 'error');
    }
}

// Render a specific page of approaching overdue requests
async function renderApproachingPage(page) {
    // Use default values if not defined
    const slaThreshold = SLA_THRESHOLD_MINUTES || 15;
    const approachingMin = APPROACHING_THRESHOLD_MIN || 12;
    
    const itemsPerPage = ITEMS_PER_PAGE || 10;
    const totalPages = Math.ceil(approachingOverdueItems.length / itemsPerPage);
    
    console.log("Rendering approaching page:", page);
    console.log("Total approaching items:", approachingOverdueItems.length);
    console.log("Total pages:", totalPages);
    
    // Ensure page is within bounds
    page = Math.max(1, Math.min(page, totalPages || 1));
    currentApproachingPage = page;
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, approachingOverdueItems.length);
    const pageItems = approachingOverdueItems.slice(startIndex, endIndex);
    
    console.log("Approaching page items:", pageItems.length);
    if (pageItems.length > 0) {
        console.log("First item time:", pageItems[0]);
    }
    
    const tableBody = document.getElementById('approaching-requests');
    if (!tableBody) {
        console.error("Approaching requests table body not found");
        return; // Safety check
    }
    
    // For debugging - direct table approach for now
    if (approachingOverdueItems.length === 0) {
        // Show empty state
        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                    <i class="fas fa-clock text-amber-500 text-2xl mb-2"></i>
                    <p>No requests approaching threshold</p>
                </td>
            </tr>
        `;
        
        // Hide pagination
        const paginationElement = document.getElementById('approaching-pagination');
        if (paginationElement) paginationElement.classList.add('hidden');
        
        return;
    }
    
    // Show pagination controls
    const paginationElement = document.getElementById('approaching-pagination');
    console.log("Pagination element:", paginationElement ? "Found" : "Not found");

    if (paginationElement) {
        paginationElement.classList.remove('hidden');
        
        // Check if all required pagination elements exist
        const currentPageEl = document.getElementById('approaching-current-page');
        const totalPagesEl = document.getElementById('approaching-total-pages');
        const pageNumberEl = document.getElementById('approaching-page-number');
        const prevButton = document.getElementById('approaching-prev-page');
        const nextButton = document.getElementById('approaching-next-page');
        
        console.log("Pagination elements check:", {
            currentPageEl: !!currentPageEl, 
            totalPagesEl: !!totalPagesEl,
            pageNumberEl: !!pageNumberEl,
            prevButton: !!prevButton,
            nextButton: !!nextButton
        });
        
        // Update pagination info
        document.getElementById('approaching-current-page').textContent = page;
        document.getElementById('approaching-total-pages').textContent = totalPages;
        document.getElementById('approaching-page-number').textContent = page;
        
        // Update pagination buttons state
        document.getElementById('approaching-prev-page').disabled = page <= 1;
        document.getElementById('approaching-next-page').disabled = page >= totalPages;
    }
    
    // Clear the table
    tableBody.innerHTML = '';
    
    // Get current time for calculations
    const now = new Date();
    
    // Add rows for each item
    pageItems.forEach(request => {
        const row = document.createElement('tr');
        
        // Calculate time metrics
        const startTime = request.assigned_at ? new Date(request.assigned_at) : new Date(request.created_at);
        console.log(`Request ${request.id} - Using ${request.assigned_at ? 'assigned_at' : 'created_at'} time: ${startTime.toISOString()}`);
        const diffMinutes = Math.floor((now - startTime) / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        
        // Calculate minutes remaining until overdue
        const minutesRemaining = slaThreshold - diffMinutes;
        
        // Style classes based on urgency
        let timeClass = 'text-amber-600';
        if (minutesRemaining <= 1) {
            timeClass = 'text-red-600 font-bold animate-pulse';
        } else if (minutesRemaining <= 2) {
            timeClass = 'text-red-500 font-semibold';
        }
        
        // Format employee_email for the remind button if it exists in the request
        let employeeEmailParam = '';
        if (request.assigned_to && window.employeeMetricsData) {
            const employeeData = window.employeeMetricsData.find(e => e.assignee === request.assigned_to);
            if (employeeData && employeeData.email) {
                employeeEmailParam = `'${employeeData.email}'`;
            }
        }
        
        row.className = 'transition-all duration-300 hover:bg-gray-50';
        row.setAttribute('data-request-id', request.id);
        
        // Add data to row
        row.innerHTML = `
            <td class="px-4 py-3">
                <span class="text-xs font-semibold">#${request.id}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex flex-col">
                    <span class="font-medium">${request.customer_name}</span>
                    <span class="text-xs text-gray-500">${request.phone_number || ''}</span>
                </div>
            </td>
            <td class="px-4 py-3">
                <span class="assigned-to font-medium ${request.assigned_to ? '' : 'text-red-500'}">
                    ${request.assigned_to || 'Unassigned'}
                </span>
            </td>
            <td class="px-4 py-3">
                <span class="status-pill status-${request.status}">
                    <i class="fas fa-${getStatusIcon(request.status)}"></i>
                    ${formatStatus(request.status)}
                </span>
            </td>
            <td class="px-4 py-3">
                <span class="elapsed-time font-mono ${timeClass}">
                    ${diffHours > 0 ? `${diffHours}h ` : ''}${diffMinutes % 60}m
                </span>
            </td>
            <td class="px-4 py-3">
                <button 
                    class="remind-btn btn-sm bg-amber-50 text-amber-600 hover:bg-amber-100 rounded px-3 py-1 transition-colors duration-200"
                    onclick="sendReminder('${request.id}', '${request.assigned_to || 'Unassigned'}', ${employeeEmailParam})"
                >
                    <i class="fas fa-bell mr-1"></i> Remind
                </button>
            </td>
        `;
        
        // Add to table
        tableBody.appendChild(row);
    });
}

// Helper function to get appropriate status icon
function getStatusIcon(status) {
    switch (status) {
        case 'completed': return 'check-circle';
        case 'in-progress': return 'spinner fa-spin';
        case 'open': return 'door-open';
        case 'request-issue': return 'exclamation-triangle';
        case 'waiting-request': return 'clock';
        default: return 'circle';
    }
}

// Setup pagination for overdue requests
function setupOverduePagination(page, totalPages) {
    // Get pagination container
    const paginationContainer = document.getElementById('overdue-pagination');
    
    if (!paginationContainer) {
        console.error("Pagination container not found");
        return;
    }
    
    // Only show pagination if there are multiple pages
    if (totalPages <= 1) {
        paginationContainer.classList.add('hidden');
        return;
    } else {
        paginationContainer.classList.remove('hidden');
    }
    
    // Update pagination contents
    document.getElementById('overdue-current-page').textContent = page;
    document.getElementById('overdue-total-pages').textContent = totalPages;
    document.getElementById('overdue-page-number').textContent = page;
    
    // Update pagination buttons
    const prevButton = document.getElementById('overdue-prev-page');
    const nextButton = document.getElementById('overdue-next-page');
    
    if (prevButton) prevButton.disabled = page <= 1;
    if (nextButton) nextButton.disabled = page >= totalPages;
    
    // Add event listeners for pagination buttons if not already added
    if (prevButton && !prevButton.hasAttribute('data-listener')) {
        prevButton.setAttribute('data-listener', 'true');
        prevButton.addEventListener('click', () => {
            if (window.currentOverduePage > 1) {
                renderOverduePage(window.currentOverduePage - 1);
            }
        });
    }
    
    if (nextButton && !nextButton.hasAttribute('data-listener')) {
        nextButton.setAttribute('data-listener', 'true');
        nextButton.addEventListener('click', () => {
            if (window.currentOverduePage < totalPages) {
                renderOverduePage(window.currentOverduePage + 1);
            }
        });
    }
}

// Add event listener for debug button
document.getElementById('debug-sla')?.addEventListener('click', async () => {
    console.clear();
    console.log("==== DEBUG MODE: Loading SLA data ====");
    
    try {
        // Disable buttons
        const debugButton = document.getElementById('debug-sla');
        const refreshButton = document.getElementById('refresh-sla');
        
        debugButton.disabled = true;
        debugButton.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-1"></i> Debugging...';
        refreshButton.disabled = true;
        
        // Get active date filter
        const dateFilter = getActiveDateFilter();
        console.log("Date filter:", dateFilter);
        
        // Get all requests that might be relevant
        const { data: allRequests, error } = await supabaseClient
            .from('requests')
            .select('*')
            .gte('created_at', dateFilter.startDate.toISOString())
            .lte('created_at', dateFilter.endDate.toISOString());
            
        if (error) throw error;
        
        console.log(`Found ${allRequests.length} total requests in date range`);
        
        // Log all potential overdue requests
        const now = new Date();
        allRequests.forEach(request => {
            const startTime = request.assigned_at ? new Date(request.assigned_at) : new Date(request.created_at);
            const waitingTimeMinutes = (now - startTime) / 60000;
            const isOpen = request.status === 'open' || request.status === 'in-progress';
            const hasResponse = request.first_response_time !== null;
            
            console.log(`Request #${request.id}:`);
            console.log(`- Status: ${request.status}`);
            console.log(`- First Response: ${request.first_response_time ? 'Yes' : 'No'}`);
            console.log(`- Created: ${new Date(request.created_at).toISOString()}`);
            console.log(`- Assigned: ${request.assigned_at ? new Date(request.assigned_at).toISOString() : 'N/A'}`);
            console.log(`- Time elapsed: ${waitingTimeMinutes.toFixed(2)} minutes`);
            
            if (isOpen && !hasResponse && waitingTimeMinutes > SLA_THRESHOLD_MINUTES) {
                console.log(`%c This request SHOULD show as overdue!`, 'color: red; font-weight: bold');
            } else if (waitingTimeMinutes > SLA_THRESHOLD_MINUTES) {
                console.log(`- Not showing as overdue because: ${!isOpen ? 'Not open/in-progress' : 'Has response'}`);
            }
            console.log('-----------------------------------');
        });
        
        // Force reload of overdue requests
        await loadOverdueRequests();
        
        // Re-enable buttons
        debugButton.disabled = false;
        debugButton.innerHTML = '<i class="fas fa-bug mr-1"></i> Debug';
        refreshButton.disabled = false;
        
        console.log("==== DEBUG COMPLETE ====");
    } catch (error) {
        console.error('Debug error:', error);
        showNotification('Error during debugging', 'error');
    }
});

// Add pagination event listeners on document load
document.addEventListener('DOMContentLoaded', function() {
    // Add overdue pagination listeners
    document.getElementById('overdue-prev-page')?.addEventListener('click', () => {
        if (window.currentOverduePage > 1) {
            renderOverduePage(window.currentOverduePage - 1);
        }
    });
    
    document.getElementById('overdue-next-page')?.addEventListener('click', () => {
        if (window.currentOverduePage < Math.ceil((window.allOverdueItems || []).length / ITEMS_PER_PAGE)) {
            renderOverduePage(window.currentOverduePage + 1);
        }
    });
    
    // Add approaching pagination listeners
    document.getElementById('approaching-prev-page')?.addEventListener('click', () => {
        if (currentApproachingPage > 1) {
            renderApproachingPage(currentApproachingPage - 1);
        }
    });
    
    document.getElementById('approaching-next-page')?.addEventListener('click', () => {
        if (currentApproachingPage < Math.ceil(approachingOverdueItems.length / ITEMS_PER_PAGE)) {
            renderApproachingPage(currentApproachingPage + 1);
        }
    });
});
  
