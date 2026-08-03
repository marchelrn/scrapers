package service

import (
	"errors"
	"testing"

	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
	"github.com/marchelrn/scrapers/pkg/registry"
	"github.com/marchelrn/scrapers/pkg/registry/methods"
)

type mockConfigRepo struct {
	configs []models.ScrapingConfig
}

func (m *mockConfigRepo) Create(config *models.ScrapingConfig) error { return nil }
func (m *mockConfigRepo) CreateWithParams(config *models.ScrapingConfig, params []models.ConfigParameter) error {
	return nil
}
func (m *mockConfigRepo) GetAll(userID string, userRole string) ([]models.ScrapingConfig, error) {
	var result []models.ScrapingConfig
	for _, c := range m.configs {
		if userRole == models.UserRoleAdmin || (c.CreatedBy != nil && *c.CreatedBy == userID) {
			result = append(result, c)
		}
	}
	return result, nil
}
func (m *mockConfigRepo) GetByID(id string, userID string, userRole string) (*models.ScrapingConfig, error) {
	for _, c := range m.configs {
		if c.ID == id {
			if userRole == models.UserRoleAdmin || (c.CreatedBy != nil && *c.CreatedBy == userID) {
				return &c, nil
			}
			return nil, errors.New("not found")
		}
	}
	return nil, errors.New("not found")
}
func (m *mockConfigRepo) Update(config *models.ScrapingConfig) error { return nil }
func (m *mockConfigRepo) Delete(id string) error                     { return nil }

type mockConfigParamRepo struct{}

func (m *mockConfigParamRepo) Create(param *models.ConfigParameter) error { return nil }
func (m *mockConfigParamRepo) GetByConfigID(configID string) ([]models.ConfigParameter, error) {
	return nil, nil
}
func (m *mockConfigParamRepo) DeleteByConfigID(configID string) error { return nil }

func TestOwnershipAuthorization(t *testing.T) {
	registry.Get().Register(methods.NewTargetURLMethod())

	user1ID := "user-1"
	user2ID := "user-2"

	repo := &mockConfigRepo{
		configs: []models.ScrapingConfig{
			{ID: "config-1", CreatedBy: &user1ID, MethodCode: "target_url"},
			{ID: "config-2", CreatedBy: &user2ID, MethodCode: "target_url"},
		},
	}

	svc := ImplScrapingConfigService(repo, &mockConfigParamRepo{})

	// Test GetAll
	// Admin gets all
	adminConfigs, _ := svc.GetAll("admin-id", models.UserRoleAdmin)
	if len(adminConfigs) != 2 {
		t.Errorf("expected admin to see 2 configs, got %d", len(adminConfigs))
	}

	// Operator gets only theirs
	user1Configs, _ := svc.GetAll(user1ID, models.UserRoleOperator)
	if len(user1Configs) != 1 || user1Configs[0].ID != "config-1" {
		t.Errorf("expected user1 to see only config-1, got %d", len(user1Configs))
	}

	// Test GetByID
	// Admin can see user2's config
	_, err := svc.GetByID("config-2", "admin-id", models.UserRoleAdmin)
	if err != nil {
		t.Errorf("expected admin to be able to access config-2, got error: %v", err)
	}

	// User1 cannot see user2's config
	_, err = svc.GetByID("config-2", user1ID, models.UserRoleOperator)
	if err == nil {
		t.Errorf("expected user1 to get error when accessing config-2, got success")
	}

	// Test Update
	// User1 cannot update user2's config
	_, err = svc.Update("config-2", dto.UpdateScrapingConfigRequest{}, user1ID, models.UserRoleOperator)
	if err == nil {
		t.Errorf("expected user1 to get error when updating config-2, got success")
	}
}
