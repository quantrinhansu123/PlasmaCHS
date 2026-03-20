import React from 'react';
import { useNavigate } from 'react-router-dom';
import RepairTicketForm from '../components/Repairs/RepairTicketForm';

const CreateRepairTicket = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/phieu-sua-chua');
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="w-full min-h-screen">
      <RepairTicketForm 
        fullPage={true} 
        onClose={handleClose} 
        onSuccess={handleSuccess} 
      />
    </div>
  );
};

export default CreateRepairTicket;
