# UC3: Post-injection symptom triage
from fastapi import APIRouter
from pydantic import BaseModel
from services.symptom_service import classify_symptoms, SymptomSeverity

router = APIRouter(prefix="/symptoms", tags=["Symptoms"])


class SymptomRequest(BaseModel):
    patient_id: str
    symptom_description: str


class SymptomResponse(BaseModel):
    patient_id: str
    severity: SymptomSeverity
    advice: str


@router.post("", response_model=SymptomResponse)
def assess_symptoms(request: SymptomRequest):
    result = classify_symptoms(request.symptom_description)
    return SymptomResponse(
        patient_id=request.patient_id,
        severity=result["severity"],
        advice=result["advice"],
    )
