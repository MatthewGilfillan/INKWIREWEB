// Account and class invitations share the same sender and overall delivery budget.
export async function deliverEmail(env, to, message) {
  const day = new Date().toISOString().slice(0, 10);
  const budget = await env.DB.prepare(`INSERT INTO email_delivery_budget (day, count) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET count = count + 1 WHERE count < 250 RETURNING count`).bind(day).first();
  if (!budget) throw new Error('Email daily limit reached');
  return env.EMAIL.send({from:{email:env.ACCOUNT_EMAIL,name:'Ink Wire Education'},to,...message});
}
