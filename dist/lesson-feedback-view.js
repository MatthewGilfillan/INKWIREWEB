import {escape} from './workspace-shared.js';
import {ratingFields} from './lesson-feedback-model.mjs';
import {renderSummary} from './summary-format.mjs';

export function assessmentHTML(assessment) {
  if(!assessment)return '<p>No individual assessment has been published for this lesson.</p>';
  if(assessment.attendance==='absent')return '<p class="feedback-absent">Absent · No star ratings recorded for this lesson.</p>';
  return `<div class="feedback-infographic" aria-label="Teacher assessment out of five stars">${Object.entries(ratingFields).map(([key,label])=>{
    const score=assessment.ratings[key];return `<div class="feedback-metric"><strong>${label}</strong><span class="feedback-stars" aria-label="${label}: ${score} out of 5"><span aria-hidden="true">${'★'.repeat(score)}<span class="empty-stars">${'☆'.repeat(5-score)}</span></span><b>${score}/5</b></span></div>`;
  }).join('')}</div><p class="feedback-caption">Teacher assessment for this lesson</p>`;
}
export function renderLessonReport(root,report,homework,assessment,{parent=false}={}) {
  root.innerHTML=`<section class="feedback-recap"><h3>Class summary</h3><div data-shared-recap></div></section><section><h3>Your lesson feedback</h3>${assessmentHTML(assessment)}${assessment?.quote?`<blockquote class="feedback-quote"><p>“${escape(assessment.quote)}”</p><footer>Your contribution to the discussion</footer></blockquote>`:''}</section><section><h3>Homework</h3><p class="feedback-homework">${escape(homework || 'No homework assigned.')}</p></section>${parent && assessment?.parentComment?`<section class="feedback-parent"><h3>A note for home</h3><p>${escape(assessment.parentComment)}</p></section>`:''}`;
  renderSummary(root.querySelector('[data-shared-recap]'),report.summary);
}
