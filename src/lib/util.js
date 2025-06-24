export function makeVariableSafe(value) {
  if (/^\d/.test(value)) {
    value = `s${value}`;
  }

  return value.replaceAll(/(\W)/g, '_').replaceAll(/_{2,}/g, '.').replace(/^_/, '').replace(/_$/, '');
}

export function kebabCase(value) {
  return value
    .replaceAll(/([\da-z])([A-Z])/g, '$1-$2')
    .replaceAll(/([A-Z])([A-Z])(?=[a-z])/g, '$1-$2')
    .toLowerCase();
}


export function getPrefixVariants(prefixes) {
  const allVariants = [];

  for (const prefix of prefixes) {
    const underscoreIndices = [...prefix.matchAll(/_/g)].map(m => m.index);

    // eslint-disable-next-line no-inner-declarations, unicorn/consistent-function-scoping
    function helper(currentString, index) {
      if (index === underscoreIndices.length) {
        // Voeg alle versies toe met extra - of _ aan het eind
        allVariants.push(`${currentString}-`, `${currentString}_`);
        return;
      }

      const underscoreIndex = underscoreIndices[index];
      const before = currentString.slice(0, underscoreIndex);
      const after = currentString.slice(underscoreIndex + 1);

      // Vervang met '_'
      helper(`${before}_${after}`, index + 1);
      
      // Vervang met '-'
      helper(`${before}-${after}`, index + 1);
    }

    helper(prefix, 0);
  }

   // Verwijder duplicaten
  return [...new Set(allVariants)];
}
