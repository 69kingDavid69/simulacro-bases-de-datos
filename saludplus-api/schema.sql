CREATE DATABASE  saludplus_db;
USE saludplus_db;

CREATE TABLE  patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT
);

CREATE TABLE  doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    specialty VARCHAR(150) NOT NULL
);

CREATE TABLE insurances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    coverage_percentage DECIMAL(5, 2) NOT NULL 
);

CREATE TABLE  treatments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    treatment_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    cost DECIMAL(10, 2) NOT NULL
);

CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id VARCHAR(100) UNIQUE,
    appointment_date DATETIME NOT NULL,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    insurance_id INT,
    treatment_id INT NOT NULL,
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    CONSTRAINT fk_app_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_app_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    CONSTRAINT fk_app_insurance FOREIGN KEY (insurance_id) REFERENCES insurances(id) ON DELETE SET NULL,
    CONSTRAINT fk_app_treatment FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE RESTRICT
);
