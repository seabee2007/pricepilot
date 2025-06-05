import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}

const Checkbox = ({ checked, onChange, label, disabled = false }: CheckboxProps) => {
  return (
    <label className="flex items-center space-x-3 cursor-pointer select-none">
      <div className="relative">
        <motion.div
          initial={false}
          animate={{
            backgroundColor: checked ? 'rgb(37, 99, 235)' : 'transparent',
            borderColor: checked ? 'rgb(37, 99, 235)' : 'rgb(209, 213, 219)',
          }}
          className={`
            w-5 h-5 rounded-md border-2 transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
            dark:border-gray-600 dark:hover:border-blue-400
          `}
        >
          <motion.div
            initial={false}
            animate={{
              opacity: checked ? 1 : 0,
              scale: checked ? 1 : 0.8,
            }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center h-full"
          >
            <Check className="w-3 h-3 text-white" />
          </motion.div>
        </motion.div>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="absolute opacity-0 w-0 h-0"
        />
      </div>
      <span className={`text-sm ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
        {label}
      </span>
    </label>
  );
};

export default Checkbox; 