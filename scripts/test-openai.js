// test-openai.js
// This tests if your OpenAI API key works directly

const OpenAI = require('openai');

// ⚠️ REPLACE THIS WITH YOUR ACTUAL OPENAI API KEY
const apiKey = 'sk-proj-YOUR-ACTUAL-OPENAI-KEY-HERE';

async function testOpenAI() {
  console.log('🧪 Testing OpenAI API key...\n');
  
  if (apiKey === 'sk-proj-YOUR-ACTUAL-OPENAI-KEY-HERE') {
    console.error('❌ ERROR: You need to replace the API key in this file!');
    console.error('Open test-openai.js and paste your OpenAI key on line 6');
    return;
  }
  
  const client = new OpenAI({ apiKey });
  
  try {
    console.log('Calling OpenAI GPT-4o...');
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: "Say 'API key works!' if you can read this." }
      ],
      max_tokens: 10
    });
    
    console.log('\n✅ SUCCESS! OpenAI API key is working!');
    console.log('Response:', completion.choices[0].message.content);
    console.log('\n👉 Now you need to add this key to Supabase Edge Functions secrets');
  } catch (error) {
    console.error('\n❌ FAILED! OpenAI API key is NOT working!');
    console.error('Error:', error.message);
    if (error.status) {
      console.error('Status:', error.status);
    }
    
    if (error.status === 401) {
      console.error('\n💡 This means your API key is invalid or expired');
      console.error('Get a new one at: https://platform.openai.com/api-keys');
    }
    
    if (error.message?.includes('insufficient_quota') || error.message?.includes('credits')) {
      console.error('\n💡 You need to add credits to your OpenAI account');
      console.error('Add credits at: https://platform.openai.com/settings/organization/billing');
    }
  }
}

testOpenAI();

