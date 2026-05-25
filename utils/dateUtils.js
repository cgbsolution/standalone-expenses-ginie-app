/**
 * Formats a date string or Date object to 'DD-MM-YYYY' format.
 * Handles:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - ISO strings (e.g., 2025-11-06T04:46:25.026Z)
 * 
 * @param {string|Date} date - The input date.
 * @returns {string} - The formatted date string 'DD-MM-YYYY'.
 */
export const formatDate = (date) => {
  if (!date) return '';

  // Return if it's already in DD-MM-YYYY format (simple check)
  if (typeof date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(date)) {
    return date;
  }

  // Handle DD/MM/YYYY string explicitly
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date.replace(/\//g, '-');
  }

  // Handle YYYY-MM-DD string explicitly (if it's just the date part, treat as local day to avoid timezone shifts)
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }

  // Fallback: Parse as Date object (handles ISO strings and other Date inputs)
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return date; // Return original if parsing fails
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const strHours = String(hours).padStart(2, '0');
  
  return `${day}-${month}-${year} ${strHours}:${minutes} ${ampm}`; 
};
