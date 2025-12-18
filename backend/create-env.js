const fs = require('fs');

const envContent = `# Database Configuration - Recommended for most uses
DATABASE_URL=postgresql://neondb_owner:npg_YLix2v6nITzF@ep-blue-cherry-a4knuag9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

# For uses requiring a connection without pgbouncer
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_YLix2v6nITzF@ep-blue-cherry-a4knuag9.us-east-1.aws.neon.tech/neondb?sslmode=require

# Parameters for constructing your own connection string
PGHOST=ep-blue-cherry-a4knuag9-pooler.us-east-1.aws.neon.tech
PGHOST_UNPOOLED=ep-blue-cherry-a4knuag9.us-east-1.aws.neon.tech
PGUSER=neondb_owner
PGDATABASE=neondb
PGPASSWORD=npg_YLix2v6nITzF

# Parameters for Vercel Postgres Templates
POSTGRES_URL=postgresql://neondb_owner:npg_YLix2v6nITzF@ep-blue-cherry-a4knuag9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_YLix2v6nITzF@ep-blue-cherry-a4knuag9.us-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_USER=neondb_owner
POSTGRES_HOST=ep-blue-cherry-a4knuag9-pooler.us-east-1.aws.neon.tech
POSTGRES_PASSWORD=npg_YLix2v6nITzF
POSTGRES_DATABASE=neondb
POSTGRES_URL_NO_SSL=postgresql://neondb_owner:npg_YLix2v6nITzF@ep-blue-cherry-a4knuag9-pooler.us-east-1.aws.neon.tech/neondb
POSTGRES_PRISMA_URL=postgresql://neondb_owner:npg_YLix2v6nITzF@ep-blue-cherry-a4knuag9-pooler.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require

# Neon Auth environment variables for Next.js
NEXT_PUBLIC_STACK_PROJECT_ID=b8429a3e-f312-464c-b9c0-05a7b38acbfa
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_8qvm27g0x9fctfksbnpsq9278cbx4fbg16bx4q4mkvz78
STACK_SECRET_SERVER_KEY=ssk_wvrab9y0ddwg24adg3904kjppy88gr1wwvn3761vr1tg8

# VAPID Keys
PUBLIC_KEY=BJFvSsHhCT8vKMQ9GtUiMmXZlnzzepGZvGqLwcbfrFxpSoBhuL6x52r_ivBW7PhgROj6X8w4wm7986xgURm1r1s
PRIVATE_KEY=ayEosRwPfOfeSMZu7pi98NnhP1CJeZynwi_Y4smxCsw
`;

fs.writeFileSync('.env', envContent, 'utf8');
console.log('✅ .env file created without BOM');
