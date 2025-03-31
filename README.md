
# Sales Dashboard

A modern web application for managing sales requests with role-based access control, built with Next.js, Tailwind CSS, and Supabase.

## Features

- 🔐 Authentication with Supabase
- 👥 Role-based access control (Admin/Employee)
- 📝 Sales request submission form
- 📊 Real-time dashboard for request management
- 👨‍💼 Admin dashboard with user management
- 🎨 Modern dark theme UI with animations
- 📱 Responsive design

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (Auth, Database, Real-time)
- Netlify (Hosting)

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Netlify account

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd requestsdashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up your Supabase project:
   - Create a new project in Supabase
   - Create the following tables:

     ```sql
     -- Users table
     create table public.users (
       id uuid references auth.users on delete cascade,
       email text not null,
       role text not null check (role in ('admin', 'employee')),
       created_at timestamp with time zone default timezone('utc'::text, now()) not null,
       primary key (id)
     );

     -- Sales requests table
     create table public.sales_requests (
       id uuid default uuid_generate_v4() primary key,
       created_at timestamp with time zone default timezone('utc'::text, now()) not null,
       customer_name text not null,
       email text not null,
       phone text not null,
       product text not null,
       quantity integer not null,
       status text not null check (status in ('pending', 'approved', 'rejected')),
       notes text
     );

     -- Set up RLS policies
     alter table public.users enable row level security;
     alter table public.sales_requests enable row level security;

     -- Users policies
     create policy "Users can view their own data"
       on public.users for select
       using (auth.uid() = id);

     create policy "Admins can view all users"
       on public.users for select
       using (
         exists (
           select 1 from public.users
           where id = auth.uid()
           and role = 'admin'
         )
       );

     -- Sales requests policies
     create policy "Anyone can create sales requests"
       on public.sales_requests for insert
       with check (true);

     create policy "Authenticated users can view all requests"
       on public.sales_requests for select
       using (auth.role() = 'authenticated');
     ```

4. Deploy to Netlify:
   - Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
   - Sign up for a Netlify account if you haven't already
   - Click "New site from Git" in your Netlify dashboard
   - Choose your repository
   - Configure the build settings:
     - Build command: `npm run build`
     - Publish directory: `.next`
   - Add your environment variables in Netlify's site settings:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click "Deploy site"

## Local Development

To run the development server locally:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard
│   ├── dashboard/         # Employee dashboard
│   ├── login/            # Login page
│   └── sales-request/    # Sales request submission
├── components/            # Reusable components
├── lib/                   # Utility functions and configurations
├── styles/               # Global styles
└── types/                # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 