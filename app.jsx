const { useState, useEffect } = React;
const { Icons } = window.Components;
const { sb, hasCreds } = window.Supa;
const Store = window.Store;
const { AuthBar } = window.Auth;

window.App = (() => {
  function formatCurrency(v){
    return new Intl.NumberFormat("en-GB", {
      style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(Number.isFinite(v) ? v : 0);
  }

  function MortgageCalculator(){
    const [user, setUser] = useState(null);

    // Core inputs
    const [propertyPrice, setPropertyPrice] = useState(750000);
    const [interestRate, setInterestRate] = useState(4.0);
    const [mortgageTerm, setMortgageTerm] = useState(27);
    const [isFirstTimeBuyer, setIsFirstTimeBuyer] = useState(false);

    // Current property
    const [currentPropertyValue, setCurrentPropertyValue] = useState(200000);
    const [outstandingMortgage, setOutstandingMortgage] = useState(150000);

    // Costs (single “Agency Fee” bucket) + Removals
    const [agencyFee, setAgencyFee] = useState(5000);
    const [removalCosts, setRemovalCosts] = useState(800);

    // Savings
    const [currentSavings, setCurrentSavings] = useState(100000);

    // Results
    const [results, setResults] = useState({
      equityFromSale:0, netProceeds:0, lbtt:0, buyingCosts:0,
      totalTransactionCosts:0, totalLiquidFunds:0, depositAvailable:0,
      loanAmount:0, monthlyPayment:0, totalRepayable:0, totalInterest:0
    });

    // Save/Load UI
    const [cfgName, setCfgName] = useState("");
    const [cfgs, setCfgs] = useState([]);
    const [selectedCfg, setSelectedCfg] = useState("");

    const backend = (sb && user) ? "supabase" : "local";

    // LBTT (Scotland)
    const calculateLBTT = (price, ftb) => {
      if(ftb && price <= 175000) return 0;
      const bands = ftb
        ? [[175000,0.0],[250000,0.02],[325000,0.05],[750000,0.1],[Infinity,0.12]]
        : [[145000,0.0],[250000,0.02],[325000,0.05],[750000,0.1],[Infinity,0.12]];
      let tax=0, from=0, remaining=price;
      for(const [to,rate] of bands){
        if(remaining<=0) break;
        const slice = Math.min(remaining, to-from);
        tax += slice*rate;
        remaining -= slice;
        from = to;
      }
      return tax;
    };

    const recalc = () => {
      const equityFromSale = Math.max(0, Number(currentPropertyValue) - Number(outstandingMortgage));
      const netProceeds = equityFromSale;

      const lbtt = calculateLBTT(Number(propertyPrice)||0, !!isFirstTimeBuyer);
      const buyingCosts = (Number(lbtt)||0) + (Number(agencyFee)||0) + (Number(removalCosts)||0);
      const totalTransactionCosts = buyingCosts;

      const totalLiquidFunds = netProceeds + (Number(currentSavings)||0);
      const depositAvailable = totalLiquidFunds - buyingCosts;
      const loanAmount = Math.max(0, (Number(propertyPrice)||0) - depositAvailable);

      const monthlyRate = (Number(interestRate)||0)/100/12;
      const numPayments = (Number(mortgageTerm)||0)*12;
      const monthlyPayment =
        loanAmount>0 && monthlyRate>0 && numPayments>0
          ? (loanAmount*(monthlyRate*Math.pow(1+monthlyRate, numPayments))) /
            (Math.pow(1+monthlyRate, numPayments)-1)
          : loanAmount>0 ? loanAmount/Math.max(1, numPayments) : 0;

      const totalRepayable = monthlyPayment * numPayments;
      const totalInterest = Math.max(0, totalRepayable - loanAmount);

      setResults({
        equityFromSale, netProceeds, lbtt, buyingCosts, totalTransactionCosts,
        totalLiquidFunds, depositAvailable, loanAmount, monthlyPayment, totalRepayable, totalInterest
      });
    };

    useEffect(()=>{ recalc(); }, [
      propertyPrice, interestRate, mortgageTerm, isFirstTimeBuyer,
      currentPropertyValue, outstandingMortgage, agencyFee, removalCosts, currentSavings
    ]);

    // Refresh config list when backend/user changes
    useEffect(()=>{ refreshList(); }, [backend, user]);

    async function refreshList(){
      try{
        if(backend==="supabase"){
          const list = await Store.sbListConfigs(user.id);
          setCfgs(list);
          if(list.length && !selectedCfg) setSelectedCfg(list[0].id);
        }else{
          const list = Store.lsListConfigs();
          setCfgs(list);
          if(list.length && !selectedCfg) setSelectedCfg(list[0].id);
        }
      }catch(e){
        console.error(e);
        alert("Failed to list saved configs: " + e.message);
      }
    }

    async function onSave(){
      const name = (cfgName||"").trim();
      if(!name){ alert("Please enter a name."); return; }
      const payload = {
        propertyPrice, interestRate, mortgageTerm, isFirstTimeBuyer,
        currentPropertyValue, outstandingMortgage, agencyFee, removalCosts, currentSavings
      };
      try{
        if(backend==="supabase") await Store.sbSaveConfig(user.id, name, payload);
        else Store.lsSaveConfig(name, payload);
        setCfgName("");
        await refreshList();
      }catch(e){ console.error(e); alert("Save failed: " + e.message); }
    }

    async function onLoad(){
      if(!selectedCfg) return;
      try{
        const payload = backend==="supabase"
          ? await Store.sbGetConfig(user.id, selectedCfg)
          : Store.lsGetConfig(selectedCfg);
        if(!payload){ alert("No payload found."); return; }
        setPropertyPrice(payload.propertyPrice);
        setInterestRate(payload.interestRate);
        setMortgageTerm(payload.mortgageTerm);
        setIsFirstTimeBuyer(!!payload.isFirstTimeBuyer);
        setCurrentPropertyValue(payload.currentPropertyValue);
        setOutstandingMortgage(payload.outstandingMortgage);
        setAgencyFee(payload.agencyFee);
        setRemovalCosts(payload.removalCosts);
        setCurrentSavings(payload.currentSavings);
      }catch(e){ console.error(e); alert("Load failed: " + e.message); }
    }

    async function onDelete(){
      if(!selectedCfg) return;
      if(!confirm("Delete this configuration?")) return;
      try{
        if(backend==="supabase") await Store.sbDeleteConfig(user.id, selectedCfg);
        else Store.lsDeleteConfig(selectedCfg);
        setSelectedCfg("");
        await refreshList();
      }catch(e){ console.error(e); alert("Delete failed: " + e.message); }
    }

    const loanToValue = results.loanAmount>0
      ? ((results.loanAmount/Math.max(1,propertyPrice))*100).toFixed(1) : "0.0";

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Auth Bar */}
          <AuthBar user={user} onUserChange={setUser} />

          {/* Save/Load Bar */}
          <div className="mb-4 bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Config name</label>
                <input type="text" value={cfgName} onChange={(e)=>setCfgName(e.target.value)}
                       placeholder="e.g. 900k_house_4.5%_25y" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <button onClick={onSave}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                <Icons.Save /> Save
              </button>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Saved configs ({(sb && user) ? "supabase" : "local"})</label>
                <select value={selectedCfg} onChange={(e)=>setSelectedCfg(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg">
                  <option value="">— select —</option>
                  {cfgs.map(c => (<option key={c.id} value={c.id}>{c.name || c.id}</option>))}
                </select>
              </div>
              <button onClick={onLoad}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                <Icons.Load /> Load
              </button>
              <button onClick={onDelete}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
                <Icons.Trash /> Delete
              </button>
            </div>
            {!hasCreds && (
              <p className="text-xs text-gray-500 mt-2">
                Using local storage. Set <code>SUPABASE_URL</code> &amp; <code>SUPABASE_ANON_KEY</code> in <code>supabase_config.js</code> to enable cloud save.
              </p>
            )}
            {hasCreds && !user && (
              <p className="text-xs text-gray-500 mt-2">
                Supabase configured. Sign in to save/load in the cloud; otherwise localStorage is used.
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <Icons.Calculator className="text-white" size={32} />
                <h1 className="text-3xl md:text-4xl font-bold text-white">Property Move Calculator</h1>
              </div>
              <p className="text-blue-100">
                Sale proceeds, Buying &amp; Selling costs (single “Agency Fee”), LBTT auto-calc &amp; mortgage
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 p-6 md:p-8">
              {/* Left: Inputs */}
              <div className="lg:col-span-2 space-y-6">
                {/* Current Property */}
                <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                  <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Icons.Building size={20} className="text-orange-600" /> Current Property (Selling)
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Current Property Value: {formatCurrency(currentPropertyValue)}</label>
                      <input type="number" value={currentPropertyValue}
                             onChange={(e)=>setCurrentPropertyValue(Number(e.target.value))}
                             className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Outstanding Mortgage: {formatCurrency(outstandingMortgage)}</label>
                      <input type="number" value={outstandingMortgage}
                             onChange={(e)=>setOutstandingMortgage(Number(e.target.value))}
                             className="w-full px-3 py-2 border rounded-lg" />
                      <p className="text-xs text-gray-600 mt-1">
                        Your equity: {formatCurrency(Math.max(0, currentPropertyValue - outstandingMortgage))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Buying & Selling Costs */}
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Icons.Trend size={20} className="text-green-600" /> Buying &amp; Selling Costs (Auto LBTT)
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2">Property Price: {formatCurrency(propertyPrice)}</label>
                        <input type="range" min="50000" max="2000000" step="5000" value={propertyPrice}
                               onChange={(e)=>setPropertyPrice(Number(e.target.value))}
                               className="w-full" />
                        <input type="number" value={propertyPrice}
                               onChange={(e)=>setPropertyPrice(Number(e.target.value))}
                               className="w-full mt-2 px-3 py-2 border rounded-lg" />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id="ftb" checked={isFirstTimeBuyer}
                               onChange={(e)=>setIsFirstTimeBuyer(e.target.checked)} className="w-4 h-4" />
                        <label htmlFor="ftb" className="text-sm font-medium">First Time Buyer (LBTT relief)</label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Agency Fee (total) — includes Solicitor, Estate Agency, Legal, Buyer Agency, Surveyor, EPC/Other (Selling)
                      </label>
                      <input type="number" value={agencyFee}
                             onChange={(e)=>setAgencyFee(Number(e.target.value))}
                             className="w-full px-3 py-2 border rounded-lg" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Removal Costs: {formatCurrency(removalCosts)}</label>
                      <input type="number" value={removalCosts}
                             onChange={(e)=>setRemovalCosts(Number(e.target.value))}
                             className="w-full px-3 py-2 border rounded-lg" />
                    </div>

                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <div className="flex justify-between text-sm">
                        <span>LBTT (auto)</span><span className="font-semibold">{formatCurrency(results.lbtt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Agency Fee (total)</span><span className="font-semibold">{formatCurrency(agencyFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Removals</span><span className="font-semibold">{formatCurrency(removalCosts)}</span>
                      </div>
                      <div className="flex justify-between font-bold mt-2 pt-2 border-t border-emerald-200">
                        <span>Total Transaction Costs</span>
                        <span className="text-emerald-700">{formatCurrency(results.totalTransactionCosts)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mortgage */}
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Icons.Home size={20} className="text-blue-600" /> Mortgage
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Interest Rate: {interestRate}%</label>
                      <input type="range" min="1" max="10" step="0.1" value={interestRate}
                             onChange={(e)=>setInterestRate(Number(e.target.value))}
                             className="w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Mortgage Term: {mortgageTerm} years</label>
                      <input type="range" min="5" max="40" step="1" value={mortgageTerm}
                             onChange={(e)=>setMortgageTerm(Number(e.target.value))}
                             className="w-full" />
                    </div>
                  </div>
                </div>

                {/* Savings */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Icons.Piggy size={20} className="text-purple-600" /> Savings
                  </h2>
                  <div>
                    <label className="block text-sm font-medium mb-2">Current Savings: {formatCurrency(currentSavings)}</label>
                    <input type="number" value={currentSavings}
                           onChange={(e)=>setCurrentSavings(Number(e.target.value))}
                           className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Right: Summaries */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
                  <h2 className="font-semibold text-xl mb-2">Monthly Payment</h2>
                  <div className="text-4xl font-bold mb-2">{formatCurrency(results.monthlyPayment)}</div>
                  <p className="text-indigo-100 text-sm">per month for {mortgageTerm} years</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-6 text-white">
                  <h2 className="font-semibold text-xl mb-4">Liquidity Summary</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between pb-2 border-b border-emerald-300">
                      <span>Sale Proceeds</span><span className="font-semibold">{formatCurrency(results.netProceeds)}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-emerald-300">
                      <span>Savings</span><span className="font-semibold">{formatCurrency(currentSavings)}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-emerald-300">
                      <span>Total Liquid Funds</span><span className="font-bold">{formatCurrency(results.totalLiquidFunds)}</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-emerald-300">
                      <span>Less: Buying Costs (LBTT + Agency Fee + Removals)</span>
                      <span className="font-semibold">-{formatCurrency(results.buyingCosts)}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-base">
                      <span className="font-bold">Available Deposit</span>
                      <span className="font-bold text-lg">{formatCurrency(Math.max(0, results.depositAvailable))}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-6 space-y-4 border-2 border-amber-200">
                  <h3 className="font-semibold text-xl mb-2 flex items-center gap-2 text-amber-800">
                    <Icons.Balance size={20} /> Costs &amp; Fees
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-amber-200">
                      <span>LBTT (auto)</span><span className="font-semibold">{formatCurrency(results.lbtt)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-amber-200">
                      <span>Agency Fee (total)</span><span className="font-semibold">{formatCurrency(agencyFee)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-amber-200">
                      <span>Removals</span><span className="font-semibold">{formatCurrency(removalCosts)}</span>
                    </div>
                    <div className="flex justify-between pt-2 bg-amber-100 rounded-lg px-3 py-2 mt-2">
                      <span className="font-bold">Total Transaction Costs</span>
                      <span className="font-bold text-amber-700">{formatCurrency(results.totalTransactionCosts)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold text-xl mb-4">Mortgage Details</h3>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Loan Required</span>
                    <span className="font-semibold">{formatCurrency(results.loanAmount)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Loan to Value (LTV)</span>
                    <span className="font-semibold">{loanToValue}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Repayable</span>
                    <span className="font-semibold">{formatCurrency(results.totalRepayable)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Interest</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(results.totalInterest)}</span>
                  </div>
                </div>

                {results.depositAvailable > 0 && (
                  <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
                    <h3 className="font-semibold text-xl mb-2 text-green-700">✓ Ready to Proceed!</h3>
                    <p className="text-gray-700 mb-2">You have sufficient funds for this purchase.</p>
                    {results.depositAvailable > results.buyingCosts && (
                      <p className="text-sm text-gray-600">
                        Remaining after deposit &amp; costs:{" "}
                        <span className="font-bold text-green-600">
                          {formatCurrency(results.totalLiquidFunds - results.buyingCosts - results.loanAmount)}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-gray-600 text-sm">
            <p>This calculator is for illustration purposes only. Consult with a financial advisor for personalised advice.</p>
          </div>
        </div>
      </div>
    );
  }

  return { MortgageCalculator };
})();
