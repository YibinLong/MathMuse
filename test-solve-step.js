const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://rhdibhidtvrbwlcfarrs.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZGliaGlkdHZyYndsY2ZhcnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDk5ODUsImV4cCI6MjA3Nzg4NTk4NX0.5N0Y2UmzGtROLYbjLOfaSQAW6qOxMNl9ity6vrk6y1g');

(async () => {
  const { data, error } = await supabase.functions.invoke('solve-step', {
    body: { prevLatex: 'x+2=5', currLatex: 'x=3', problem: 'Solve x+2=5' }
  });
  console.log({ data, error });
})();