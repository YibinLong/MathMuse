const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://rhdibhidtvrbwlcfarrs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZGliaGlkdHZyYndsY2ZhcnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDk5ODUsImV4cCI6MjA3Nzg4NTk4NX0.5N0Y2UmzGtROLYbjLOfaSQAW6qOxMNl9ity6vrk6y1g');

(async () => {
  // Case A: incorrect first step (x=3) for 2x=4
  const { data: aData, error: aErr } = await supabase.functions.invoke('solve-step', {
    body: { prevLatex: '2x=4', currLatex: 'x=3', problem: '2x=4' }
  });
  console.log('Case A:', { data: aData, error: aErr });

  // Case B: correct after wrong
  const { data: bData, error: bErr } = await supabase.functions.invoke('solve-step', {
    body: { prevLatex: 'x=3', currLatex: 'x=2', problem: '2x=4' }
  });
  console.log('Case B:', { data: bData, error: bErr });

  // Case C: correct final answer for x+2=5
  const { data: cData, error: cErr } = await supabase.functions.invoke('solve-step', {
    body: { prevLatex: 'x+2=5', currLatex: 'x=3', problem: 'x+2=5' }
  });
  console.log('Case C:', { data: cData, error: cErr });
})();