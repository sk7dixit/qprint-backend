
require('dotenv').config({ path: '../.env' }); // Adjust path if needed
const { createClient } = require('@supabase/supabase-js');

// WARNING: Use SERVICE ROLE KEY for backend/cleanup scripts
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
    console.log('Starting cleanup job...');

    // Rule: Delete files older than 24 hours
    const hours = 24;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // 1. Select pending files older than cutoff
    const { data: files, error } = await supabase
        .from('files')
        .select('id, path')
        .eq('cleanup_status', 'pending')
        .lt('created_at', cutoff)
        .limit(50); // Batch size

    if (error) {
        console.error('Error fetching files:', error);
        return;
    }

    if (!files || files.length === 0) {
        console.log('No files to clean.');
        return;
    }

    console.log(`Found ${files.length} files to clean.`);

    // 2. Lock records
    const ids = files.map(f => f.id);
    const { error: updateError } = await supabase
        .from('files')
        .update({
            cleanup_status: 'processing',
            cleanup_started_at: new Date().toISOString()
        })
        .in('id', ids);

    if (updateError) {
        console.error('Error locking records:', updateError);
        return;
    }

    // 3. Delete from storage
    const paths = files.map(f => f.path);
    const { error: storageError, data: storageData } = await supabase.storage.from('uploads').remove(paths);

    if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Optional: Update status to 'failed' or 'pending' retry
    } else {
        console.log('Files deleted from storage.');
    }

    // 4. Final delete from DB
    const { error: deleteError } = await supabase.from('files').delete().in('id', ids);

    if (deleteError) {
        console.error('Error deleting records from DB:', deleteError);
    } else {
        console.log(`Successfully deleted ${ids.length} records.`);
    }
}

cleanup();
