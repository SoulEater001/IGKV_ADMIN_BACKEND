export function displayValue(
    value: number | null
): string {
    return value === null
        ? ''
        : String(value);
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function toNumber(
    value: number | string | null | undefined
): number | null {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    const numberValue =
        Number(value);

    return Number.isNaN(numberValue)
        ? null
        : numberValue;
}

export function formatDate(
    value: Date | string,
    languageId: number = 2
): string {

    const dateString =
        value instanceof Date
            ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
            : String(value).slice(0, 10);

    const [year, month, day] =
        dateString.split('-');

    if (!year || !month || !day) {
        return dateString;
    }

    const months =
        languageId === 1
            ? {
                '01': 'जनवरी',
                '02': 'फरवरी',
                '03': 'मार्च',
                '04': 'अप्रैल',
                '05': 'मई',
                '06': 'जून',
                '07': 'जुलाई',
                '08': 'अगस्त',
                '09': 'सितंबर',
                '10': 'अक्टूबर',
                '11': 'नवंबर',
                '12': 'दिसंबर'
            }
            : {
                '01': 'January',
                '02': 'February',
                '03': 'March',
                '04': 'April',
                '05': 'May',
                '06': 'June',
                '07': 'July',
                '08': 'August',
                '09': 'September',
                '10': 'October',
                '11': 'November',
                '12': 'December'
            };

    const monthName =
        months[month as keyof typeof months];

    if (!monthName) {
        return dateString;
    }

    return `${day}-${monthName}-${year}`;
}


export function getMinMax(
    values: (number | null)[]
): { min: number | null; max: number | null } {

    const validValues =
        values.filter(
            (value): value is number =>
                value !== null &&
                value !== undefined &&
                !Number.isNaN(value)
        );

    if (validValues.length === 0) {
        return {
            min: null,
            max: null
        };
    }

    return {
        min: Math.min(...validValues),
        max: Math.max(...validValues)
    };
}

export function formatRange(
    min: number | null,
    max: number | null
): string {

    if (min === null && max === null) {
        return '-';
    }

    if (min === max) {
        return displayValue(min);
    }
    return `${displayValue(min)} – ${displayValue(max)}`;
}