import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getCrew = (params: Record<string, string>) =>
    api.get('/crew', { params }).then(r => r.data)

export const getCrewDetail = (id: string) =>
    api.get(`/crew/${id}`).then(r => r.data)

export const getAlerts = () =>
    api.get('/alerts').then(r => r.data)

export const simulateAlert = (scenario = 'sharma_escalation') =>
    api.post('/alerts/simulate', { scenario }).then(r => r.data)

export const getReplacements = (crewId: string) =>
    api.get(`/replacements/${crewId}`).then(r => r.data)

export const assignReplacement = (forCrewId: string, candidateId: string, dutyId: string) =>
    api.post('/assign_replacement', { for_crew_id: forCrewId, candidate_id: candidateId, duty_id: dutyId }).then(r => r.data)

export const getCascade = (crewId: string) =>
    api.get(`/cascade/${crewId}`).then(r => r.data)

export const getModelMetrics = () =>
    api.get('/model/metrics').then(r => r.data)

export const retrainModel = () =>
    api.post('/model/retrain').then(r => r.data)

export const getStats = () =>
    api.get('/stats').then(r => r.data)

export default api
