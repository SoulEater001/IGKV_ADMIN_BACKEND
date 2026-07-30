function validateLocationHierarchy(state, district, block) {

    // State advisory
    if (state && !district && !block) {
        return true;
    }

    // District advisory
    if (state && district && !block) {
        return true;
    }

    // Block advisory
    if (state && district && block) {
        return true;
    }

    return false;
}

export default validateLocationHierarchy;