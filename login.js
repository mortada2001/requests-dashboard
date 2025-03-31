// Initialize Supabase client
const supabaseUrl = 'https://pdcssepqmgzpkayzfqta.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkY3NzZXBxbWd6cGtheXpmcXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MzczMjksImV4cCI6MjA1NjQxMzMyOX0.NqN7b7itdA8Tz0sG4fzSI4Y19P5syYFWnmKwANbH1IY'
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form')
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin)
    }

    // Check for existing session
    checkSession()
})

async function handleLogin(event) {
    event.preventDefault()
    
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

        // Get user role
        const { data: userData, error: roleError } = await supabase
            .from('requests_users')
            .select('role')
            .eq('email', email)
            .single()

        if (roleError) throw roleError

        // Redirect based on role
        switch (userData.role) {
            case 'sales':
                window.location.href = 'sales.html'
                break
            case 'non-voice':
                window.location.href = 'non-voice.html'
                break
            case 'admin':
                // Admin users are still redirected to admin.html by default
                window.location.href = 'admin.html'
                break
            default:
                throw new Error('Invalid user role')
        }
    } catch (error) {
        alert('Error logging in: ' + error.message)
    }
}

async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
        console.error('Error checking session:', error)
        return
    }

    if (session) {
        // Get user role
        const { data: userData, error: roleError } = await supabase
            .from('requests_users')
            .select('role')
            .eq('email', session.user.email)
            .single()

        if (roleError) {
            console.error('Error getting user role:', roleError)
            return
        }

        // Redirect based on role
        switch (userData.role) {
            case 'sales':
                window.location.href = 'sales.html'
                break
            case 'non-voice':
                window.location.href = 'non-voice.html'
                break
            case 'admin':
                // Admin users are still redirected to admin.html by default
                window.location.href = 'admin.html'
                break
        }
    }
}
