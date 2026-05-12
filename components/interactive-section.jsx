// React app — compiled by Babel standalone in browser (no import/export/require)
const { useState, useEffect, useCallback, useRef } = React;

// Reusable Card component
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>{children}</div>
);

// Reusable Button component
const Button = ({ children, onClick, variant = "primary", className = "" }) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "hover:bg-gray-100 text-gray-600"
  };
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${variants[variant]} ${className}`}>{children}</button>;
};

const App = () => {
  const [items, setItems] = useState([]);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Improve Bry92/hostack-deploy</h1>
        <Card>
          <p className="text-gray-500">Loading items...</p>
        </Card>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);