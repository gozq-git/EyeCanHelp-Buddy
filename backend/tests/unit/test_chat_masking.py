from services.chatbot.masking import mask_sensitive_text


def test_mask_sensitive_text_masks_date_with_required_rule():
    assert mask_sensitive_text("DOB 25-03-1965") == "DOB 2*-0*-19**"
    assert mask_sensitive_text("DOB 01/12/2004") == "DOB 0*/1*/20**"


def test_mask_sensitive_text_masks_phone_email_and_id_deterministically():
    text = "Call +6591234567 email john.doe@example.com id S1234567A"
    expected = "Call +65******67 email j*******@example.com id S*****67A"

    assert mask_sensitive_text(text) == expected
    assert mask_sensitive_text(text) == expected
