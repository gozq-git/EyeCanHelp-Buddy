EyeCanHelp Buddy: Chatbot Proposal (Draft 1)
1. General Workflow (User Perspective)
The following steps outline the manual process and validation performed by the IVT Nurse, which the chatbot seeks to automate or assist:

Clinical Check: The IVT Nurse checks the EPIC notes for:

Diagnosis 

Target eye for injection (Right/Left/Both) 

Number of injections listed for the patient 

Validity of consent 

Documentation: The nurse prints sticky labels for the IVT Financial Counselling (FC) and manually fills in the forms.

Patient Validation: The nurse validates the following data with the patient:

Identity: Using two patient identifiers.

Medical History: Recent hospital admissions (past 3 months), recent stroke or heart attack (past 6 months), current antibiotic use, or possible pregnancy.

Procedure Details: Confirming the eye(s) and medication.

Payment: Informing the patient of the price per injection and validating the payment mode.

Administrative Actions: If using a Next of Kin's (NOK) Medisave, a form is provided for the patient to complete.

Consent: The patient signs the required forms.

Procedure: Anaesthetic eye drops are administered and the IVT procedure begins.

Post-Procedure: The patient receives a "Post IVT Information sheet" containing key advisory information.

2. Platform Components
Component	Identification
Seeds	
IVT procedures, IVT Financial Counselling and Advise (FC), Post IVT Information sheet

Producers	
Nurses providing IVT procedures based on patient data

Consumers	
Patients

Interactions	
Nurse checks EPIC for diagnosis; fills in IVT FC; validates patient details, medical history, and payment; patient signs forms; nurse starts procedure; patient receives advisory sheet

Magnet	
Users informed of estimated charges; patients receive advisory information sheets

Toolbox	
Azure API Management, MongoDB, Stripe

Matchmaker	
Frequency of procedures by breed/style (Legacy data); patient ratings and reviews for service providers

3. Scope of Work
3.1 Microservices

LLM Chatbot Service: The core AI interaction layer.

Recommendation Feature: Intelligent guidance based on patient data.

3.2 Use-Case Diagrams & Specifications
Use Case 1: Acquiring Patients’ Records from EPIC Service

Description: The LLM Chatbot pulls required clinical data from the EPIC service.

Primary Actor: LLM Chatbot Service 

Secondary Actor: EPIC Service 

Main Flow:

Chatbot pulls diagnosis from EPIC.

Chatbot pulls the target eye (Right/Left/Both) from EPIC.

Chatbot pulls the required number of injections from EPIC.

Chatbot verifies the patient's validity of consent from EPIC.


Use Case 2: Acquiring Patient’s Acknowledgement

Description: The chatbot requests information from the patient and secures their acknowledgement.

Primary Actor: LLM Chatbot Service 

Secondary Actor: Patient 

Main Flow:

Chatbot verifies identity using two identifiers.

Chatbot collects medical history (Recent admissions, stroke/heart attack, antibiotics, pregnancy).

Chatbot informs the patient of procedure details and costs.

Chatbot confirms the payment mode (e.g., NOK Medisave).

Chatbot secures final acknowledgement from the patient.


Use Case 3: Patient Enquiring Post-Injection Information

Description: The patient uses the chatbot to enquire about post-injection symptoms.

Primary Actor: LLM Chatbot Service 

Secondary Actor: Patient 

Main Flow:
Chatbot categorizes symptoms as mild or severe.

Mild Symptoms: Eye discomfort, mild pain, superficial bleeding, or floaters.

Serious Symptoms: Increased eye pain, blurring vision, light sensitivity, chest pain/tightness, or limb numbness/weakness.

Emergency Action: For serious symptoms, the chatbot directs the patient to Emergency services or calls 9123 4567.

4. Database Schema

TBL_PATIENT (PostgreSQL)
Field Name,Field Type,Description
patient_id,varchar(100),Patient’s hashed Identity number 
patient_name,varchar(100),User’s Name 
patient_d.o.b,datetime,Patient’s date of birth 
phone_number,varchar(10),User contact number 

TBL_PATIENT_RECORDS (MongoDB)
Field Name,Field Type,Description
record_id,varchar(100),Patient’s hashed Identity number 
record_name,varchar(100),User’s Name 
record_diagnosis,varchar(100),Patient Diagnosis 
record_eyes,varchar(10),Left/Right/Both eyes 
record_number_of_injections,varchar(10),Total injections required 
record_validity_of_consent,datetime,Expiry/Date of consent 
record_last3mths_admission,varchar(100),Prior hospital admissions 
record_stroke_heartAtt_last6mths,varchar(100),Recent cardiac/stroke history 
record_taking_antibiotics,varchar(10),Current antibiotic status 
record_preganant,varchar(10),Pregnancy status 

TBL_IVT (PostgreSQL)
Field Name,Field Type,Description
ivt_id,varchar(100),Patient’s hashed Identity number 
ivt_name,varchar(100),User’s Name 
ivt_eyes,varchar(10),Target eye(s) 
ivt_medication,varchar(100),Medication dosage 

TBL_PAYMENT (PostgreSQL)
Field Name,Field Type,Description
payment_id,varchar(100),Patient’s hashed Identity number 
payment_name,varchar(100),User’s Name 
payment_diagnosis,varchar(10),Target eye(s) 
payment_maxMedisave,varchar(100),Maximum claimable amount 
payment_estConstPerInjection,varchar(100),Estimated cost 
payment_mode,varchar(100),Payment Mode 