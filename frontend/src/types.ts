export type Tier = 'GREEN' | 'AMBER' | 'RED' | 'PROTECTED'

export interface ShapDriver {
    feature: string
    impact: number
    abs_impact: number
}

export interface Prediction {
    fatigue_base_score: number
    fatigue_ml_score: number
    behavioral_boost: number
    final_fatigue_score: number
    tier: Tier
    unfit_risk_probability: number
    shap_drivers: ShapDriver[]
}

export interface TrajectoryPoint {
    date: string
    final_fatigue_score: number
    tier: Tier
}

export interface Duty {
    duty_id: string
    departure_time: string
    route: string[]
    aircraft_type: string
    duration_hrs: number
    station: string
}

export interface CrewProfile {
    crew_id: string
    name: string
    role: string
    base: string
    aircraft_type: string
    habitual_sleep_start: string
    habitual_sleep_end: string
    sick_leave_last_90_days: number
    features: Record<string, number | string>
    prediction: Prediction
    trajectory: TrajectoryPoint[]
    next_duties: Duty[]
    updated_at: string
    is_demo?: boolean
}

export interface Alert {
    crew_id: string
    crew_name: string
    tier_from: Tier
    tier_to: Tier
    reason: string
    top_factors: string[]
    timestamp: string
    status: string
    responsible_team: string
    demo?: boolean
}

export interface Replacement {
    for_crew_id: string
    rank: number
    candidate_id: string
    candidate_name: string
    base: string
    aircraft_type: string
    role: string
    tier: Tier
    final_fatigue_score: number
    reach_time_hrs: number
    dgca_compliant: boolean
    hours_flown_28d: number
    hours_available: number
    why_eligible: string
    disruption_cost_impact: number
    assigned: boolean
}

export interface CascadeFlight {
    crew_id: string
    flight_id: string
    departure_time: string
    route: string
    station: string
    aircraft: string
    risk_level: string
    protected: boolean
    passengers: number
}

export interface ModelMetrics {
    roc_auc: number
    avg_precision: number
    accuracy: number
    precision: number
    recall: number
    confusion_matrix: number[][]
    false_positives_count: number
    false_negatives_count: number
    top_shap_features: { feature: string; importance: number }[]
    last_trained: string
}

export interface Stats {
    total_crew: number
    green_count: number
    amber_count: number
    red_count: number
    avg_fatigue_score: number
    predicted_cancellations_avoided: number
    estimated_savings_inr_lakhs: number
    demo_crew_id: string
    demo_crew_name: string
    demo_duty_in_hours: number
}
