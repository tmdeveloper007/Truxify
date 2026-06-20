import React from 'react';
import { useOrderRealtime } from '../hooks/useOrderRealtime';

export const OrderStatusTracker = ({ orderId }) => {
  const { order, loading, error } = useOrderRealtime(orderId);

  if (loading) return <div className="status-loading">Syncing active order stream...</div>;
  if (error) return <div className="status-error">Error binding data stream: {error}</div>;
  if (!order) return <div className="status-empty">No trace found for order reference.</div>;

  const getStatusClass = (step) => {
    const statuses = ['PENDING', 'ACCEPTED', 'PICKED_UP', 'DELIVERED'];
    const currentIndex = statuses.indexOf(order.status);
    const stepIndex = statuses.indexOf(step);
    return stepIndex <= currentIndex ? 'step-completed' : 'step-pending';
  };

  return (
    <div className="order-tracker-card">
      <div className="tracker-header">
        <h3>Order Reference: #{order.id}</h3>
        <span className={`status-badge status-${order.status.toLowerCase()}`}>
          {order.status}
        </span>
      </div>
      
      <div className="tracker-timeline">
        <div className={`timeline-step ${getStatusClass('PENDING')}`}>Order Placed</div>
        <div className={`timeline-step ${getStatusClass('ACCEPTED')}`}>Driver Dispatched</div>
        <div className={`timeline-step ${getStatusClass('PICKED_UP')}`}>In Transit</div>
        <div className={`timeline-step ${getStatusClass('DELIVERED')}`}>Arrived / Completed</div>
      </div>

      <div className="tracker-footer">
        <p>Last Broadcast Frame: {new Date(order.updated_at).toLocaleTimeString()}</p>
      </div>
    </div>
  );
};
