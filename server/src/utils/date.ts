export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  
  while (curDate < endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Monday to Friday
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}
