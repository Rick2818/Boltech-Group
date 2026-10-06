export async function runIndependentRsiCycle({ execute, roles = ['RSI-01','RSI-02','RSI-03'] }) {
  const results = [];
  for (const rsi of roles) {
    try { results.push({ rsi, ...await execute(rsi) }); }
    catch (error) { results.push({ rsi, success:false, code:/^[A-Z_]+$/.test(error.code||'')?error.code:'EXECUTION_UNCONFIRMED' }); }
  }
  return results;
}
