/**
 * Seed script — creates test accounts with known credentials.
 * Run: node backend/scripts/seed.js
 *
 * Requires SUPABASE_SERVICE_KEY (service-role key) to use the Admin API.
 * Reads .env from the backend directory automatically.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env from the backend directory (one level up from scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_KEY is required. Set it in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_ACCOUNTS = [
  {
    email: 'parent@test.com',
    password: 'test1234',
    displayName: 'Test Parent',
    children: [
      { name: 'Alice', age: 8, level: 'beginner', avatar_emoji: '\u{1F430}', pin: '1234' },
      { name: 'Bob', age: 11, level: 'intermediate', avatar_emoji: '\u{1F98A}', pin: '5678' },
    ],
  },
  {
    email: 'admin@test.com',
    password: 'admin1234',
    displayName: 'Admin User',
    children: [],
  },
];

async function seed() {
  console.log('Seeding test accounts...\n');

  for (const account of TEST_ACCOUNTS) {
    console.log(`Creating: ${account.email}`);

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === account.email);

    let authUser;
    if (existing) {
      console.log('  Auth user exists, updating password...');
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: account.password,
      });
      if (error) {
        console.error(`  Failed to update: ${error.message}`);
        continue;
      }
      authUser = data.user;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });
      if (error) {
        console.error(`  Failed to create auth user: ${error.message}`);
        continue;
      }
      authUser = data.user;
    }

    console.log(`  Auth ID: ${authUser.id}`);

    // Check if parent record already exists
    const { data: existingParent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', account.email)
      .single();

    let parent;
    if (existingParent) {
      const { data, error: updateErr } = await supabase
        .from('parents')
        .update({
          auth_id: authUser.id,
          display_name: account.displayName,
          coppa_consent: true,
          coppa_consent_date: new Date().toISOString(),
        })
        .eq('id', existingParent.id)
        .select()
        .single();
      if (updateErr) {
        console.error(`  Failed to update parent: ${updateErr.message}`);
        continue;
      }
      parent = data;
    } else {
      const { data, error: insertErr } = await supabase
        .from('parents')
        .insert({
          auth_id: authUser.id,
          email: account.email,
          display_name: account.displayName,
          coppa_consent: true,
          coppa_consent_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertErr) {
        console.error(`  Failed to insert parent: ${insertErr.message}`);
        continue;
      }
      parent = data;
    }

    console.log(`  Parent ID: ${parent.id}`);

    // Create children
    for (const child of account.children) {
      // Check if child already exists
      const { data: existingChild } = await supabase
        .from('students')
        .select('id')
        .eq('parent_id', parent.id)
        .eq('name', child.name)
        .single();

      if (existingChild) {
        console.log(`  Child "${child.name}" already exists (${existingChild.id})`);
        continue;
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          parent_id: parent.id,
          name: child.name,
          age: child.age,
          level: child.level,
          avatar_emoji: child.avatar_emoji,
          pin_hash: child.pin || '0000',
        })
        .select()
        .single();

      if (studentError) {
        console.error(`  Failed to create child "${child.name}": ${studentError.message}`);
      } else {
        console.log(`  Created child: ${child.name} (${student.id})`);
      }
    }

    console.log('');
  }

  console.log('Seeding complete!\n');
  console.log('Test accounts:');
  console.log('  Parent: parent@test.com / test1234');
  console.log('  Admin:  admin@test.com / admin1234');
}

seed().catch(console.error);
