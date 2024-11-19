const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Enhance test connection to verify permissions
async function testConnection() {
    try {
        // Test basic connection
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .single();
            
        if (error) throw error;

        // Test write permissions
        const { error: writeError } = await supabase
            .from('auth_tokens')
            .update({ status: 'expired' })
            .eq('id', '00000000-0000-0000-0000-000000000000'); // Using dummy ID

        if (writeError && !writeError.message.includes('no rows')) {
            console.warn('⚠️  Warning: Write permissions test failed:', writeError.message);
        } else {
            console.log('✅ Supabase connection successful with write permissions');
        }
    } catch (error) {
        console.error('❌ Supabase connection error:', error.message);
        throw error; // Re-throw to prevent app from starting with bad connection
    }
}

// Simple function to check token expiry
async function checkTokenExpiry() {
    try {
        const { data, error } = await supabase
            .from('auth_tokens')
            .update({ status: 'expired' })
            .eq('status', 'pending')
            .lt('expires_at', new Date().toISOString());

        if (error) {
            console.error('Token expiry update failed:', {
                message: error.message,
                details: error.details,
                code: error.code
            });
        } else {
            console.log(`Updated ${data?.length ?? 0} expired tokens`);
        }
    } catch (error) {
        console.error('Error checking token expiry:', error);
    }
}

// Check for expired tokens every minute
setInterval(checkTokenExpiry, 60000);

// Run initial connection test
testConnection();

module.exports = supabase; 