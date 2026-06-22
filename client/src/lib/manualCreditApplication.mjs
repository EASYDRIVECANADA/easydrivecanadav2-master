const clean = (value) => String(value ?? '').trim()

const normalizeLabel = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')

const findValue = (rows, labels) => {
  const wanted = labels.map(normalizeLabel)
  return rows.find((row) => wanted.includes(normalizeLabel(row.label)))?.value || ''
}

const splitName = (value) => {
  const parts = clean(value).split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

const splitCityProvince = (value) => {
  const raw = clean(value)
  const match = raw.match(/^(.+?),\s*([A-Z]{2})$/i)
  if (!match) return { city: raw, province: '' }
  return { city: clean(match[1]), province: clean(match[2]).toUpperCase() }
}

export const emptyCreditApplicationDetails = {
  dateOfBirth: '',
  streetAddress: '',
  city: '',
  province: '',
  postalCode: '',
  mobilePhone: '',
  homePhone: '',
  monthlyBudget: '',
  occupation: '',
  employerName: '',
  employmentDuration: '',
  housing: '',
  housingPayment: '',
  residenceDuration: '',
  leadSource: '',
}

export function parseGetGoingCreditApplicationEmail(text) {
  const rows = clean(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/)
      return match ? { label: clean(match[1]), value: clean(match[2]) } : null
    })
    .filter(Boolean)

  const applicantName = findValue(rows, ['Applicant Name', 'Name'])
  const { firstName, lastName } = splitName(applicantName)
  const cityProvince = splitCityProvince(findValue(rows, ['City']))
  const mobilePhone = findValue(rows, ['Mobile Phone', 'Cell Phone', 'Phone'])
  const homePhone = findValue(rows, ['Home Phone'])
  const monthlyIncome = findValue(rows, ['Monthly Income'])
  const employmentStatus = findValue(rows, ['Employment Status'])

  return {
    firstName,
    lastName,
    email: findValue(rows, ['Email Address', 'Email']),
    phone: mobilePhone || homePhone,
    vehicleInterest: findValue(rows, ['Vehicle Type', 'Vehicle']),
    employmentStatus,
    monthlyIncome,
    applicationDetails: {
      dateOfBirth: findValue(rows, ['Birthday', 'Date of birth', 'DOB']),
      streetAddress: findValue(rows, ['Address', 'Street address']),
      city: cityProvince.city,
      province: cityProvince.province,
      postalCode: findValue(rows, ['Postal Code', 'Postal']),
      mobilePhone,
      homePhone,
      monthlyBudget: findValue(rows, ['Monthly Budget', 'Budget']),
      occupation: findValue(rows, ['Occupation']),
      employerName: findValue(rows, ['Employer', 'Company name']),
      employmentDuration: findValue(rows, ['Employment Duration (in months)', 'Employment Duration', 'Time employed']),
      housing: findValue(rows, ['House on Rent or Own?', 'Rent or Own', 'Housing']),
      housingPayment: findValue(rows, ['House Monthly Payment', 'Monthly housing payment']),
      residenceDuration: findValue(rows, ['House Living Time (in months)', 'Time at residence', 'Time at address']),
      leadSource: findValue(rows, ['Lead Source', 'Source']),
    },
  }
}

export function buildCreditApplicationMessageRows(details = {}, core = {}) {
  return [
    ['Date of birth', details.dateOfBirth],
    ['Street address', details.streetAddress],
    ['City', details.city],
    ['Province / territory', details.province],
    ['Postal code', details.postalCode],
    ['Mobile phone', details.mobilePhone],
    ['Home phone', details.homePhone],
    ['Vehicle type', core.vehicleInterest],
    ['Monthly budget', details.monthlyBudget],
    ['Employment', core.employmentStatus],
    ['Occupation', details.occupation],
    ['Company name', details.employerName],
    ['Time employed at company', details.employmentDuration],
    ['Monthly income', core.monthlyIncome],
    ['Housing', details.housing],
    ['House monthly payment', details.housingPayment],
    ['Time at address', details.residenceDuration],
    ['Credit situation', core.creditScore],
    ['Down payment', core.downPayment],
    ['Referrer', details.leadSource],
  ].filter(([, value]) => clean(value))
}
