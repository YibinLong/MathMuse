// test-edge-function.js
// This tests if the Supabase Edge Function is working

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rhdibhidtvrbwlcfarrs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZGliaGlkdHZyYndsY2ZhcnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDk5ODUsImV4cCI6MjA3Nzg4NTk4NX0.5N0Y2UmzGtROLYbjLOfaSQAW6qOxMNl9ity6vrk6y1g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEdgeFunction() {
  console.log('🧪 Testing Edge Function with dry run...\n');
  
  try {
    console.log('Calling ocr-latex function with dryRun=true...');
    const { data, error } = await supabase.functions.invoke('ocr-latex', {
      body: { 
        attemptId: 'test',
        stepId: 'test',
        imageBase64: 'test',
        dryRun: true  // This returns mock data without calling OpenAI
      }
    });
    
    if (error) {
      console.error('\n❌ Edge Function error!');
      console.error('Error:', error);
      console.error('\n💡 The function exists but returned an error');
    } else {
      console.log('\n✅ SUCCESS! Edge Function is responding!');
      console.log('Response:', data);
      console.log('\n👉 Dry run works. Now let\'s test with OpenAI...');
    }
  } catch (err) {
    console.error('\n❌ Exception calling Edge Function!');
    console.error('Error:', err.message);
  }
}

async function testWithOpenAI() {
  console.log('\n\n🧪 Testing Edge Function WITH OpenAI...\n');
  
  try {
    console.log('Calling ocr-latex function with a test image (this will use OpenAI)...');
    console.log('This will take 5-10 seconds...\n');
    
    // A tiny 1x1 transparent PNG as base64 (just for testing)
    const tinyImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const { data, error } = await supabase.functions.invoke('ocr-latex', {
      body: { 
        attemptId: 'test',
        stepId: 'test',
        imageBase64: tinyImage
      }
    });
    
    if (error) {
      console.error('\n❌ Edge Function error when calling OpenAI!');
      console.error('Error:', error);
      
      if (error.message?.includes('OPENAI_API_KEY')) {
        console.error('\n💡 The OPENAI_API_KEY is not set in Supabase!');
        console.error('Run: supabase secrets set OPENAI_API_KEY=sk-proj-your-key');
      }
    } else {
      console.log('\n✅ SUCCESS! Edge Function + OpenAI working!');
      console.log('LaTeX:', data.latex);
      console.log('Confidence:', data.confidence);
      console.log('\n🎉 Everything is configured correctly!');
    }
  } catch (err) {
    console.error('\n❌ Exception!');
    console.error('Error:', err.message);
  }
}

async function runTests() {
  await testEdgeFunction();
  await testWithOpenAI();
}

runTests();

