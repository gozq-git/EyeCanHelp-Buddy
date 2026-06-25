import pytest

from schemas.ivt import IVTSchema

pytestmark = pytest.mark.unit


def test_ivt_schema_defaults_resource_type():
    ivt = IVTSchema(
        ivt_id="IVT001",
        ivt_name="Tan Ah Kow",
        ivt_eyes="OD",
        ivt_medication="Faricimab (Vabysmo)",
    )

    assert ivt.resourceType == "MedicationRequest"
    assert ivt.ivt_id == "IVT001"
