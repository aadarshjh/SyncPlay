import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://beeofvtbapyuksaawbas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZW9mdnRiYXB5dWtzYWF3YmFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjA5NDcsImV4cCI6MjA4ODE5Njk0N30.RozZYyGEKyHe8SFBdzgNjzju5_tmYnikgecQabChCtk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorage() {
    try {
        console.log("Testing connection...");
        const { data, error } = await supabase.storage.getBucket('music');
        if (error) {
            console.error('Bucket Error:', error);
        } else {
            console.log('Bucket Details:', data);
        }
    } catch (e) {
        console.error("Catch Error:", e);
    }
}
testStorage();
