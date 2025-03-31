# Requests Dashboard

A web-based dashboard for managing sales requests and non-voice support interactions. Built with HTML, JavaScript, and Supabase for the backend.

## Features

- User authentication with role-based access
- Sales request submission and tracking
- Non-voice support dashboard
- Real-time status updates
- Request assignment system
- Expandable request details
- Modern and responsive UI

## Tech Stack

- HTML5
- JavaScript (ES6+)
- Tailwind CSS
- Font Awesome Icons
- Supabase (Backend and Authentication)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/requests-dashboard.git
cd requests-dashboard
```

2. Open `index.html` in your web browser or set up a local server.

3. Configure Supabase:
   - Create a Supabase project
   - Update the Supabase URL and anon key in the JavaScript files
   - Set up the required tables (requests_users, requests)

## Project Structure

```
requests-dashboard/
├── index.html          # Entry point
├── login.html          # Login page
├── sales.html          # Sales dashboard
├── non-voice.html      # Non-voice dashboard
├── styles.css          # Global styles
├── login.js           # Login functionality
├── sales.js           # Sales dashboard functionality
└── non-voice.js       # Non-voice dashboard functionality
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 