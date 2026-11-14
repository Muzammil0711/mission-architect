// MISSION ARCHITECT — Scoring (0-1000) with transparent breakdown
./engine/types       → ./types
./engine/rules       → ./rules
./engine/simulation  → ./simulation
export interface ScoreInputs {
  rules: RulesResult
  sim: SimResult
  design: MissionDesign
  teamCooperationScore?: number // 0-100, only used in team mode
  learningBonus?: number // 0-100, solo mode
}

export function computeScore(inputs: ScoreInputs): ScoreBreakdown {
  const { rules, sim, design, teamCooperationScore, learningBonus } = inputs

  // 1. Mission success & objectives met (35%)
  let success = 0
  const canLaunch = rules.canLaunch ? 1 : 0
  const noCriticalErrors = rules.violations.filter((v) => v.severity === 'error').length === 0 ? 1 : 0
  const metMinScience = sim.summary.finalScience >= 50 ? 1 : 0 // simplified threshold
  success = (canLaunch + noCriticalErrors + metMinScience) / 3 * 100

  // 2. Scientific value returned (25%)
  const science = sim.summary.finalScience // 0-100

  // 3. Resource efficiency (15%) — margins on mass/power/budget
  let efficiency = 100
  const margins: string[] = []
  if (rules.resources.mass.status === 'exceeded') efficiency -= 30
  else if (rules.resources.mass.status === 'warning') efficiency -= 10
  if (rules.resources.power.status === 'exceeded') efficiency -= 25
  else if (rules.resources.power.status === 'warning') efficiency -= 10
  if (rules.resources.budget.status === 'exceeded') efficiency -= 30
  else if (rules.resources.budget.status === 'warning') efficiency -= 10
  if (rules.resources.data.status === 'exceeded') efficiency -= 15
  else if (rules.resources.data.status === 'warning') efficiency -= 5
  efficiency = Math.max(0, Math.min(100, efficiency))
  if (rules.resources.mass.status !== 'ok') margins.push('Mass margin thin')
  if (rules.resources.budget.status !== 'ok') margins.push('Budget margin thin')
  if (rules.resources.data.status !== 'ok') margins.push('Data margin thin')

  // 4. Engineering decision quality / risk management (15%)
  const errorCount = rules.violations.filter((v) => v.severity === 'error').length
  const warningCount = rules.violations.filter((v) => v.severity === 'warning').length
  let risk = 100 - errorCount * 15 - warningCount * 5
  risk = Math.max(0, Math.min(100, risk))
  const riskDetails: string[] = []
  if (errorCount > 0) riskDetails.push(`${errorCount} blocking design error(s)`)
  if (warningCount > 0) riskDetails.push(`${warningCount} caution(s)`)
  if (sim.summary.safeModeDays > 0) riskDetails.push(`${sim.summary.safeModeDays} safe-mode day(s)`)

  // 5. Collaboration & coordination (team) / Learning bonus (solo) (10%)
  let collab = 0
  const collabDetails: string[] = []
  if (teamCooperationScore != null) {
    collab = teamCooperationScore
    collabDetails.push(`Team coordination: ${teamCooperationScore}/100`)
  } else if (learningBonus != null) {
    collab = learningBonus
    collabDetails.push(`Learning bonus: ${learningBonus}/100`)
  }

  const total = Math.round(
    success * 0.35 + science * 0.25 + efficiency * 0.15 + risk * 0.15 + collab * 0.10,
  )

  const details: string[] = [
    `Mission success: ${Math.round(success)}/100 (weighted 35%)`,
    `Science value: ${Math.round(science)}/100 (weighted 25%)`,
    `Resource efficiency: ${Math.round(efficiency)}/100 (weighted 15%)${margins.length ? ' — ' + margins.join(', ') : ''}`,
    `Engineering risk: ${Math.round(risk)}/100 (weighted 15%)${riskDetails.length ? ' — ' + riskDetails.join(', ') : ''}`,
    `Coordination/learning: ${Math.round(collab)}/100 (weighted 10%)${collabDetails.length ? ' — ' + collabDetails.join(', ') : ''}`,
  ]

  return { total, success, science, efficiency, risk, collab, details }
}
