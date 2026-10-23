/** Small arithmetic parser for the launcher's = prefix. No code evaluation. */
export function calculate(input: string): number | null {
    if (input.length > 128 || !/^[\d\s.+*/()%\-]+$/.test(input)) return null;
    const tokens = input.match(/\d+(?:\.\d*)?|\.\d+|[()+*/%\-]/g) || [];
    let index = 0;
    const primary = (): number => {
        const token = tokens[index++];
        if (token === '-') return -primary();
        if (token === '+') return primary();
        if (token === '(') {
            const value = expression();
            if (tokens[index++] !== ')') throw new Error('missing closing parenthesis');
            return value;
        }
        if (!token || !/^(?:\d|\.)/.test(token)) throw new Error('expected number');
        return Number(token);
    };
    const term = (): number => {
        let value = primary();
        while (['*', '/', '%'].includes(tokens[index])) {
            const op = tokens[index++];
            const right = primary();
            value = op === '*' ? value * right : op === '/' ? value / right : value % right;
        }
        return value;
    };
    const expression = (): number => {
        let value = term();
        while (['+', '-'].includes(tokens[index])) {
            value = tokens[index++] === '+' ? value + term() : value - term();
        }
        return value;
    };
    try {
        const value = expression();
        return index === tokens.length && Number.isFinite(value) ? value : null;
    } catch (_) {
        return null;
    }
}
