// Compute net balances and a minimal set of "who pays whom" transfers.

import db from "../db.js";

export function tripBalances(tripId) {
  const members = db
    .prepare(
      `SELECT u.id, u.name, u.avatar_color
         FROM trip_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.trip_id = ?
        ORDER BY u.name`
    )
    .all(tripId);

  // net[userId] = (total they paid) - (total they owe).  Positive => owed money.
  const net = new Map(members.map((m) => [m.id, 0]));

  const expenses = db
    .prepare("SELECT id, paid_by, amount FROM expenses WHERE trip_id = ?")
    .all(tripId);

  for (const exp of expenses) {
    if (net.has(exp.paid_by)) net.set(exp.paid_by, net.get(exp.paid_by) + exp.amount);
    const splits = db
      .prepare("SELECT user_id, amount FROM expense_splits WHERE expense_id = ?")
      .all(exp.id);
    for (const s of splits) {
      if (net.has(s.user_id)) net.set(s.user_id, net.get(s.user_id) - s.amount);
    }
  }

  const balances = members.map((m) => ({
    ...m,
    balance: round2(net.get(m.id) || 0),
  }));

  return { members, balances, settlements: settle(balances) };
}

// Greedy minimal-transfer settlement.
function settle(balances) {
  const creditors = balances
    .filter((b) => b.balance > 0.009)
    .map((b) => ({ ...b, amt: b.balance }))
    .sort((a, b) => b.amt - a.amt);
  const debtors = balances
    .filter((b) => b.balance < -0.009)
    .map((b) => ({ ...b, amt: -b.balance }))
    .sort((a, b) => b.amt - a.amt);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0.009) {
      transfers.push({
        from: { id: debtors[i].id, name: debtors[i].name, avatar_color: debtors[i].avatar_color },
        to: { id: creditors[j].id, name: creditors[j].name, avatar_color: creditors[j].avatar_color },
        amount: round2(pay),
      });
    }
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.009) i++;
    if (creditors[j].amt < 0.009) j++;
  }
  return transfers;
}

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
