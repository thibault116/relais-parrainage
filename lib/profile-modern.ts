import type {PublicProfile} from './profile';
import {answerLabels,intakeQuestions,type IntakeAnswers} from './intake';
import {discoveryValues,discoveryFilters} from './profile-discovery';
// Project only current questionnaire fields. Keep historical storage intact during the owner preview.
export function currentProfileSections(p:PublicProfile){
 const labels=(key:string)=>{const options=discoveryFilters.find(f=>f.key===key)?.options||[];return discoveryValues(p,key).map(id=>options.find(o=>o.id===id)?.label).filter((s):s is string=>!!s&&s!=='Autre')};
 const questions=p.resell?.version===2?intakeQuestions(p.resell as IntakeAnswers):[];
 const answer=(id:string)=>{const q=questions.find(q=>q.id===id);return q&&p.resell?.version===2?answerLabels(p.resell,q):[]};
 return {skills:questions.length?answer('help'):labels('expertise'),platforms:questions.length?answer('platforms'):labels('platform'),availability:questions.length?answer('availability'):labels('availability'),support:answer('support'),goal:p.role==='beginner'?answer('goal'):[],methods:labels('method')};
}
