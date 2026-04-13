import React from 'react';
import TaxIcon from '../assets/TaxIcon';
import './ToolbarButton.css';

interface ToolbarButtonProps {
    onClick: () => void;
    isActive: boolean;
    title: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ onClick, isActive, title }) => {
    return (
        <div className="toolbar-button-wrapper">
            <button
                className={`toolbar-btn${isActive ? ' active' : ''}`}
                onClick={onClick}
                title={title}
            >
                <TaxIcon size={28} color={isActive ? '#4fc3f7' : '#ffffff'} />
            </button>
        </div>
    );
};

export default ToolbarButton;
