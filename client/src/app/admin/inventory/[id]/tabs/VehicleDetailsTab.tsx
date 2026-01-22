'use client'

interface VehicleFormData {
  id?: string
  make?: string
  model?: string
  year?: number
  trim?: string
  stockNumber?: string
  keyNumber?: string
  series?: string
  equipment?: string
  vin?: string
  price?: number
  mileage?: number
  exteriorColor?: string
  interiorColor?: string
  transmission?: string
  drivetrain?: string
  fuelType?: string
  bodyStyle?: string
  description?: string
  features?: string | string[]
  city?: string
  province?: string
  status?: string
  inventoryType?: string
}

interface VehicleDetailsTabProps {
  formData: VehicleFormData
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
}

export default function VehicleDetailsTab({ formData, onChange, onSubmit, saving }: VehicleDetailsTabProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
          <input
            type="text"
            name="make"
            required
            value={formData.make || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
          <input
            type="text"
            name="model"
            required
            value={formData.model || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
          <input
            type="number"
            name="year"
            required
            value={formData.year || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
          <input
            type="text"
            name="trim"
            value={formData.trim || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock Number (Unit ID)</label>
          <input
            type="text"
            name="stockNumber"
            value={formData.stockNumber || ''}
            onChange={onChange}
            placeholder="e.g., 8FDJTG"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            🔑 Key Number (Keybox)
            <span className="text-gray-500 font-normal ml-2">Optional</span>
          </label>
          <input
            type="text"
            name="keyNumber"
            value={formData.keyNumber || ''}
            onChange={onChange}
            placeholder="e.g., K-123, FOB-45"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Track which key/keyfob this vehicle uses from your keybox</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Series</label>
          <input
            type="text"
            name="series"
            value={formData.series || ''}
            onChange={onChange}
            placeholder="e.g., 40K4, 45KF"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">VIN *</label>
          <input
            type="text"
            name="vin"
            required
            value={formData.vin || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
          <input
            type="number"
            name="price"
            required
            value={formData.price || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mileage (km) *</label>
          <input
            type="number"
            name="mileage"
            required
            value={formData.mileage || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={formData.status || 'ACTIVE'}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="ACTIVE">Active</option>
            <option value="SOLD">Sold</option>
            <option value="PENDING">Pending</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Type</label>
          <select
            name="inventoryType"
            value={formData.inventoryType || 'FLEET'}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="FLEET">Fleet Cars</option>
            <option value="PREMIERE">Premiere Cars</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Exterior Color *</label>
          <input
            type="text"
            name="exteriorColor"
            required
            value={formData.exteriorColor || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interior Color</label>
          <input
            type="text"
            name="interiorColor"
            value={formData.interiorColor || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Transmission *</label>
          <select
            name="transmission"
            required
            value={formData.transmission || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Select...</option>
            <option value="Automatic">Automatic</option>
            <option value="Manual">Manual</option>
            <option value="CVT">CVT</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Drivetrain</label>
          <select
            name="drivetrain"
            value={formData.drivetrain || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Select...</option>
            <option value="FWD">FWD</option>
            <option value="RWD">RWD</option>
            <option value="AWD">AWD</option>
            <option value="4WD">4WD</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type *</label>
          <select
            name="fuelType"
            required
            value={formData.fuelType || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Select...</option>
            <option value="Gasoline">Gasoline</option>
            <option value="Diesel">Diesel</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Electric">Electric</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body Style *</label>
          <select
            name="bodyStyle"
            required
            value={formData.bodyStyle || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Select...</option>
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="Truck">Truck</option>
            <option value="Coupe">Coupe</option>
            <option value="Hatchback">Hatchback</option>
            <option value="Van">Van</option>
            <option value="Wagon">Wagon</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input
            type="text"
            name="city"
            required
            value={formData.city || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
          <select
            name="province"
            required
            value={formData.province || ''}
            onChange={onChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
          >
            <option value="">Select...</option>
            <option value="ON">Ontario</option>
            <option value="QC">Quebec</option>
            <option value="BC">British Columbia</option>
            <option value="AB">Alberta</option>
            <option value="MB">Manitoba</option>
            <option value="SK">Saskatchewan</option>
            <option value="NS">Nova Scotia</option>
            <option value="NB">New Brunswick</option>
            <option value="NL">Newfoundland</option>
            <option value="PE">PEI</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
        <textarea
          name="equipment"
          rows={2}
          value={formData.equipment || ''}
          onChange={onChange}
          placeholder="e.g., A3 40 KOMFORT AWD SEDAN"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
        ></textarea>
        <p className="mt-1 text-xs text-gray-500">Full equipment description from EDC inventory</p>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          name="description"
          rows={4}
          value={formData.description || ''}
          onChange={onChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
        ></textarea>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Features (comma-separated)</label>
        <input
          type="text"
          name="features"
          value={Array.isArray(formData.features) ? formData.features.join(', ') : formData.features || ''}
          onChange={onChange}
          placeholder="Leather seats, Sunroof, Backup camera..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#118df0] focus:border-transparent"
        />
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#118df0] text-white py-3 rounded-lg font-semibold hover:bg-[#0d6ebd] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
