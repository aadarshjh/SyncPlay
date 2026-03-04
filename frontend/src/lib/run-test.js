import { supabase } from './test-supabase.js';

async function runTest() {
    try {
        console.log("Testing connection...");
        const { data, error } = await supabase.storage.from('music').list();
        if (error) {
            console.log('List Error:', error.message);
        } else {
            console.log('List Data:', data);
        }

        console.log("Testing upload...");
        // Test mock upload
        const mockFile = Buffer.from('hello world', 'utf-8');
        const { data: uploadData, error: uploadError } = await supabase.storage.from('music').upload('test-upload.txt', mockFile, { contentType: 'text/plain' });

        if (uploadError) {
            console.log('Upload Error:', uploadError.message);
        } else {
            console.log('Upload Success:', uploadData);
        }

    } catch (e) {
        console.error(e);
    }
}

runTest();
