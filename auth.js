const { useState, useEffect } = React;
const { sb, hasCreds } = window.Supa;
const { Icons } = window.Components;

window.Auth = (() => {
  function AuthBar({ user, onUserChange }){
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    useEffect(() => {
      if(!sb) return;
      (async () => {
        const { data } = await sb.auth.getSession();
        onUserChange(data.session?.user || null);
      })();
      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
        onUserChange(session?.user || null);
      });
      return () => sub?.subscription?.unsubscribe?.();
    }, [onUserChange]);

    async function signUp(){
      try{
        const { error } = await sb.auth.signUp({ email, password });
        if(error) throw error;
        alert("Sign-up successful. Check your inbox if email confirmation is enabled.");
      }catch(e){ alert("Sign-up failed: " + e.message); }
    }
    async function signIn(){
      try{
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if(error) throw error;
      }catch(e){ alert("Sign-in failed: " + e.message); }
    }
    async function signOut(){
      try{ await sb.auth.signOut(); }catch(e){ alert("Sign-out failed: " + e.message); }
    }

    return (
      <div className="mb-4 bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Auth Backend</label>
            <div className="text-sm">
              {hasCreds ? <span className="text-emerald-700">Supabase connected</span>
                        : <span className="text-gray-600">Supabase not configured (using localStorage)</span>}
            </div>
          </div>

          {user && hasCreds ? (
            <>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Signed in as</label>
                <div className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-gray-50">
                  <Icons.User /> <span className="text-sm">{user.email || user.id}</span>
                </div>
              </div>
              <button onClick={signOut}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
                <Icons.Logout /> Sign out
              </button>
            </>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="email" placeholder="email@example.com" value={email}
                     onChange={(e)=>setEmail(e.target.value)} className="px-3 py-2 border rounded-lg" />
              <input type="password" placeholder="password" value={password}
                     onChange={(e)=>setPassword(e.target.value)} className="px-3 py-2 border rounded-lg" />
              <div className="flex gap-2">
                <button onClick={signIn} disabled={!hasCreds}
                        className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">Sign in</button>
                <button onClick={signUp} disabled={!hasCreds}
                        className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Sign up</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return { AuthBar };
})();
