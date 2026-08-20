function isValidLgCode(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        Number.isInteger(Number(value)) &&
        Number(value) > 0
    );
}

function isEmpty(value) {
    return (
        value === null ||
        value === undefined ||
        value === ''
    );
}

function validateLocationHierarchy(
    state,
    district,
    block
) {
    const hasState = isValidLgCode(state);

    const hasDistrict = isValidLgCode(district);

    const hasBlock = isValidLgCode(block);

    const districtEmpty = isEmpty(district);

    const blockEmpty = isEmpty(block);

    // State level
    if (
        hasState &&
        districtEmpty &&
        blockEmpty
    ) {
        return true;
    }

    // District level
    if (
        hasState &&
        hasDistrict &&
        blockEmpty
    ) {
        return true;
    }

    // Block level
    if (
        hasState &&
        hasDistrict &&
        hasBlock
    ) {
        return true;
    }

    return false;
}

export default validateLocationHierarchy;