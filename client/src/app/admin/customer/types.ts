export type CustomerRow = {
  id: string
  name: string
  phone: string
  mobile: string
  email: string
  dl: string
  rin?: string
  dob: string
}

export type CustomerForm = {
  customerType: 'IND' | 'CMP'
  idType: 'RIN' | 'DL'
  firstName: string
  middleName: string
  lastName: string
  rin: string
  driversLicense: string
  dlExpiry: string
  dateOfBirth: string
  legalName: string
  companyName: string
  mvda: string
  yearEnd: string
  taxNumber: string
  contactFirstName: string
  contactLastName: string
  salespersonReg: string
  fax: string
  streetAddress: string
  suiteApt: string
  city: string
  province: string
  postalCode: string
  country: string
  phone: string
  mobile: string
  email: string
  salesperson: string
  visibility: string
  notes: string
}

export type CreditEmployment = {
  employmentType: string
  position: string
  occupation: string
  employerName: string
  employerPhone: string
  yearsEmployed: string
  streetAddress: string
  suiteApt: string
  city: string
  province: string
  postalCode: string
  country: string
}

export type CreditIncome = {
  incomeType: string
  rateHr: string
  hrsWeek: string
  monthlyGross: string
  annualGross: string
  incomeNotes: string
}

export type CreditForm = {
  salutation: string
  gender: string
  maritalStatus: string
  residenceOwnership: string
  marketValue: string
  mortgageAmount: string
  monthlyPayment: string
  bank: string
  yearsAtPresentAddress: string
  employments: CreditEmployment[]
  incomes: CreditIncome[]
  declaredBankruptcy: boolean
  bankruptcyDuration?: string
  hasCollections: boolean
  collectionNotes?: string
  financialInstitution: string
  desiredMonthlyPayment: string
}
