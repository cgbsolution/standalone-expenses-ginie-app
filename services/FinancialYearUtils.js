/**
 * Financial Year Utility Functions for India
 * 
 * In India, Financial Year runs from April 1 to March 31
 * Format: YYYY-YY (e.g., 2024-25 for April 2024 to March 2025)
 */

/**
 * Get the current Financial Year according to India's financial year system
 * Financial Year runs from April 1 to March 31
 * 
 * @param {Date} date - Optional date to calculate FY for (defaults to current date)
 * @returns {string} Financial Year in format "YYYY-YY" (e.g., "2024-25")
 * 
 * @example
 * // If current date is April 15, 2024 → returns "2024-25"
 * // If current date is March 15, 2024 → returns "2023-24"
 * getCurrentFinancialYear()
 */
export const getCurrentFinancialYear = (date = new Date()) => {
  const currentDate = new Date(date);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so add 1

  // Financial Year starts from April (month 4)
  // If current month is April or later, FY starts from current year
  // If current month is before April, FY started from previous year
  let fyStartYear;
  
  if (currentMonth >= 4) {
    // April to December - FY starts from current year
    fyStartYear = currentYear;
  } else {
    // January to March - FY started from previous year
    fyStartYear = currentYear - 1;
  }

  const fyEndYear = fyStartYear + 1;
  const fyEndYearShort = String(fyEndYear).slice(-2); // Last 2 digits

  return `${fyStartYear}-${fyEndYearShort}`;
};

/**
 * Get Financial Year start date (April 1)
 * 
 * @param {Date} date - Optional date to calculate FY start for (defaults to current date)
 * @returns {Date} Financial Year start date (April 1)
 * 
 * @example
 * // If current date is April 15, 2024 → returns April 1, 2024
 * // If current date is March 15, 2024 → returns April 1, 2023
 * getFinancialYearStartDate()
 */
export const getFinancialYearStartDate = (date = new Date()) => {
  const currentDate = new Date(date);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  let fyStartYear;
  if (currentMonth >= 4) {
    fyStartYear = currentYear;
  } else {
    fyStartYear = currentYear - 1;
  }

  // Return April 1 of the FY start year
  return new Date(fyStartYear, 3, 1); // Month 3 = April (0-indexed)
};

/**
 * Get Financial Year end date (March 31)
 * 
 * @param {Date} date - Optional date to calculate FY end for (defaults to current date)
 * @returns {Date} Financial Year end date (March 31)
 * 
 * @example
 * // If current date is April 15, 2024 → returns March 31, 2025
 * // If current date is March 15, 2024 → returns March 31, 2024
 * getFinancialYearEndDate()
 */
export const getFinancialYearEndDate = (date = new Date()) => {
  const currentDate = new Date(date);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  let fyEndYear;
  if (currentMonth >= 4) {
    fyEndYear = currentYear + 1;
  } else {
    fyEndYear = currentYear;
  }

  // Return March 31 of the FY end year
  return new Date(fyEndYear, 2, 31); // Month 2 = March (0-indexed), day 31
};

/**
 * Check if a given date falls within the current Financial Year
 * 
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is within current FY
 * 
 * @example
 * isDateInCurrentFinancialYear(new Date('2024-06-15')) // Returns true if current FY is 2024-25
 */
export const isDateInCurrentFinancialYear = (date) => {
  const fyStart = getFinancialYearStartDate();
  const fyEnd = getFinancialYearEndDate();
  const checkDate = new Date(date);

  return checkDate >= fyStart && checkDate <= fyEnd;
};

/**
 * Get Financial Year for a specific date
 * 
 * @param {Date} date - Date to get FY for
 * @returns {string} Financial Year in format "YYYY-YY"
 * 
 * @example
 * getFinancialYearForDate(new Date('2024-06-15')) // Returns "2024-25"
 * getFinancialYearForDate(new Date('2024-02-15')) // Returns "2023-24"
 */
export const getFinancialYearForDate = (date) => {
  return getCurrentFinancialYear(date);
};

/**
 * Get previous Financial Year
 * 
 * @param {Date} date - Optional date to calculate previous FY for (defaults to current date)
 * @returns {string} Previous Financial Year in format "YYYY-YY"
 * 
 * @example
 * // If current FY is 2024-25 → returns "2023-24"
 * getPreviousFinancialYear()
 */
export const getPreviousFinancialYear = (date = new Date()) => {
  const currentFY = getCurrentFinancialYear(date);
  const [startYear] = currentFY.split('-');
  const prevStartYear = parseInt(startYear) - 1;
  const prevEndYearShort = String(prevStartYear + 1).slice(-2);
  
  return `${prevStartYear}-${prevEndYearShort}`;
};

/**
 * Get next Financial Year
 * 
 * @param {Date} date - Optional date to calculate next FY for (defaults to current date)
 * @returns {string} Next Financial Year in format "YYYY-YY"
 * 
 * @example
 * // If current FY is 2024-25 → returns "2025-26"
 * getNextFinancialYear()
 */
export const getNextFinancialYear = (date = new Date()) => {
  const currentFY = getCurrentFinancialYear(date);
  const [startYear] = currentFY.split('-');
  const nextStartYear = parseInt(startYear) + 1;
  const nextEndYearShort = String(nextStartYear + 1).slice(-2);
  
  return `${nextStartYear}-${nextEndYearShort}`;
};

export default {
  getCurrentFinancialYear,
  getFinancialYearStartDate,
  getFinancialYearEndDate,
  isDateInCurrentFinancialYear,
  getFinancialYearForDate,
  getPreviousFinancialYear,
  getNextFinancialYear,
};

