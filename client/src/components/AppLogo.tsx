import React from 'react';

const AppLogo = () => {
    return (
        <div className="brand-container">
            <div className="logo-box">
                <svg className="burning-animation">
                    <path className="flame-main" d="..." />
                    <path className="flame-flick" d="..." />
                    <path className="flame-core" d="..." />
                </svg>
            </div>
            <div className="brand-text">
                <span>EXPENSE</span>
                <span>ROASTER</span>
            </div>
        </div>
    );
};

export default AppLogo;